"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, canChangeRoleTo } from "@/lib/auth/rbac";
import { writeAudit } from "@/lib/chatbots/audit";
import { getUserById, setUserDisabled, updateUserRole } from "@/lib/auth/queries";
import { createChatbot, softDeleteChatbot, updateChatbot } from "@/lib/chatbots/admin-queries";
import { getBotById } from "@/lib/chatbots/registry";
import { updateSystemPrompt, rollbackSystemPrompt } from "@/lib/chatbots/prompts";
import {
  resolveModel,
  ProviderNotConfiguredError,
  UnsupportedModelError,
} from "@/lib/chatbots/providers";
import { ChatbotUpsertSchema, ChatbotPatchSchema } from "@/lib/validation/chatbot";
import { USER_ROLES, type UserRole } from "@/db/schema/users";
import { AI_PROVIDERS, TOOL_IDS } from "@/db/schema/chatbots";
import { db } from "@/db";
import { platformSettings, SIGNUP_POLICIES } from "@/db/schema/platform-settings";
import { eq } from "drizzle-orm";
import { ensurePlatformSettingsRow } from "@/lib/chatbots/settings";
import { z } from "zod";

// ---------- Users -------------------------------------------------------------

export async function changeUserRoleAction(formData: FormData) {
  const actor = await requireRole("admin");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  if (!userId) return { error: "Missing userId" };
  if (!USER_ROLES.includes(role)) return { error: "Invalid role" };
  const target = await getUserById(userId);
  if (!target) return { error: "Not found" };
  const allowed = canChangeRoleTo(
    { id: actor.id, role: actor.role },
    { id: target.id, role: target.role },
    role,
  );
  if (!allowed.ok) return { error: allowed.reason };
  if (target.role === role) return { ok: true };
  await updateUserRole({ userId, role });
  await writeAudit({
    actorId: actor.id,
    targetUserId: userId,
    event: "user.role_changed",
    payload: { before: target.role, after: role },
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleUserDisabledAction(formData: FormData) {
  const actor = await requireRole("admin");
  const userId = String(formData.get("userId") ?? "");
  const disabled = formData.get("disabled") === "on" || formData.get("disabled") === "true";
  if (!userId) return { error: "Missing userId" };
  const target = await getUserById(userId);
  if (!target) return { error: "Not found" };
  if (target.id === actor.id && disabled) return { error: "Cannot disable yourself" };
  if (target.disabled === disabled) return { ok: true };
  await setUserDisabled(userId, disabled);
  await writeAudit({
    actorId: actor.id,
    targetUserId: userId,
    event: "user.disabled_changed",
    payload: { before: target.disabled, after: disabled },
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------- Chatbots ----------------------------------------------------------

function parseChatbotForm(formData: FormData) {
  const tools = formData.getAll("tools").map(String).filter((t) =>
    (TOOL_IDS as readonly string[]).includes(t),
  );
  const allowedRoles = formData.getAll("allowedRoles").map(String).filter((r) =>
    (USER_ROLES as readonly string[]).includes(r),
  );
  const maxTokensStr = String(formData.get("maxTokens") ?? "");
  return {
    slug: String(formData.get("slug") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    provider: String(formData.get("provider") ?? ""),
    modelId: String(formData.get("modelId") ?? ""),
    engine: String(formData.get("engine") ?? "ai_sdk"),
    temperature: Number(formData.get("temperature") ?? 0.3),
    maxTokens: maxTokensStr ? Number(maxTokensStr) : null,
    maxSteps: Number(formData.get("maxSteps") ?? 3),
    systemPrompt: String(formData.get("systemPrompt") ?? ""),
    tools,
    allowedRoles,
    rateLimitTokens: Number(formData.get("rateLimitTokens") ?? 20),
    rateLimitWindow: String(formData.get("rateLimitWindow") ?? "1 h"),
    dailyCostCapUsd: Number(formData.get("dailyCostCapUsd") ?? 0),
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
  };
}

export async function createChatbotAction(formData: FormData) {
  const actor = await requireRole("admin");
  const raw = parseChatbotForm(formData);
  const parsed = ChatbotUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const summary = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs ?? []).join(", ")}`)
      .join("; ");
    return {
      error: summary ? `Validation failed — ${summary}` : "Validation failed",
      fields: fieldErrors,
    };
  }
  try {
    resolveModel(parsed.data.provider, parsed.data.modelId);
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) return { error: e.message };
    if (e instanceof UnsupportedModelError) return { error: e.message };
    throw e;
  }
  try {
    const bot = await createChatbot(
      { ...parsed.data, description: parsed.data.description ?? null, createdBy: actor.id },
      actor.id,
    );
    await writeAudit({
      actorId: actor.id,
      botId: bot.id,
      event: "bot.created",
      payload: { slug: bot.slug, provider: bot.provider, modelId: bot.modelId },
    });
    revalidatePath("/admin/chatbots");
    redirect(`/admin/chatbots/${bot.id}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("unique")) return { error: "Slug already in use" };
    throw e;
  }
}

export async function updateChatbotAction(formData: FormData) {
  const actor = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id" };
  const existing = await getBotById(id);
  if (!existing) return { error: "Not found" };

  const raw = parseChatbotForm(formData);
  const parsed = ChatbotPatchSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const summary = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs ?? []).join(", ")}`)
      .join("; ");
    return {
      error: summary ? `Validation failed — ${summary}` : "Validation failed",
      fields: fieldErrors,
    };
  }
  const patch = parsed.data;

  if (patch.provider || patch.modelId) {
    const provider = (patch.provider ?? existing.provider) as z.infer<typeof ChatbotPatchSchema>["provider"];
    const modelId = (patch.modelId ?? existing.modelId) as z.infer<typeof ChatbotPatchSchema>["modelId"];
    try {
      if (provider && modelId) resolveModel(provider, modelId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  if (patch.systemPrompt !== undefined && patch.systemPrompt !== existing.systemPrompt) {
    await updateSystemPrompt({ botId: id, newPrompt: patch.systemPrompt, actorId: actor.id });
    delete patch.systemPrompt;
  }
  if (Object.keys(patch).length > 0) {
    await updateChatbot(id, {
      ...patch,
      description: patch.description === undefined ? undefined : patch.description ?? null,
    });
  }

  await writeAudit({
    actorId: actor.id,
    botId: id,
    event: "bot.updated",
    payload: { changedFields: Object.keys(parsed.data) },
  });
  revalidatePath(`/admin/chatbots/${id}`);
  revalidatePath("/admin/chatbots");
  return { ok: true };
}

export async function deleteChatbotAction(formData: FormData) {
  const actor = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id" };
  const bot = await getBotById(id);
  if (!bot) return { error: "Not found" };
  await softDeleteChatbot(id);
  await writeAudit({
    actorId: actor.id,
    botId: id,
    event: "bot.deleted",
    payload: { slug: bot.slug },
  });
  revalidatePath("/admin/chatbots");
  redirect("/admin/chatbots");
}

export async function rollbackPromptAction(formData: FormData) {
  const actor = await requireRole("admin");
  const botId = String(formData.get("botId") ?? "");
  const version = Number(formData.get("toVersion"));
  if (!botId || !version) return { error: "Missing fields" };
  try {
    await rollbackSystemPrompt({ botId, toVersion: version, actorId: actor.id });
    revalidatePath(`/admin/chatbots/${botId}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Settings ---------------------------------------------------------

const SettingsSchema = z.object({
  globalChatDisabled: z.boolean().optional(),
  defaultRateLimitTokens: z.coerce.number().int().min(1).max(10_000).optional(),
  defaultRateLimitWindow: z.enum(["1 m", "5 m", "15 m", "1 h", "1 d"]).optional(),
  defaultDailyCostCapUsd: z.coerce.number().min(0).max(10_000).optional(),
  fallbackProvider: z.enum(AI_PROVIDERS).nullable().optional(),
  signupPolicy: z.enum(SIGNUP_POLICIES).optional(),
  dataRetentionDays: z.coerce.number().int().min(1).max(3650).optional(),
  brandName: z.string().min(1).max(64).optional(),
  brandPrimaryColor: z.string().max(16).nullable().optional(),
});

export async function updateSettingsAction(formData: FormData) {
  const actor = await requireRole("admin");
  await ensurePlatformSettingsRow();
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "globalChatDisabled") raw[key] = value === "on" || value === "true";
    else raw[key] = value === "" ? undefined : value;
  }
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Validation failed", fields: parsed.error.flatten().fieldErrors };
  }
  await db
    .update(platformSettings)
    .set({ ...parsed.data, updatedAt: new Date(), updatedBy: actor.id })
    .where(eq(platformSettings.id, 1));
  await writeAudit({
    actorId: actor.id,
    event: "settings.updated",
    payload: { changedFields: Object.keys(parsed.data) },
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function toggleKillSwitchAction(formData: FormData) {
  const actor = await requireRole("admin");
  await ensurePlatformSettingsRow();
  const enabled = formData.get("enabled") === "true" || formData.get("enabled") === "on";
  await db
    .update(platformSettings)
    .set({ globalChatDisabled: enabled, updatedAt: new Date(), updatedBy: actor.id })
    .where(eq(platformSettings.id, 1));
  await writeAudit({
    actorId: actor.id,
    event: "settings.kill_switch_toggled",
    payload: { enabled },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  return { ok: true };
}

// Void-returning wrappers for direct <form action={...}> binding (Next 15 types).
export async function changeUserRoleActionVoid(formData: FormData): Promise<void> {
  await changeUserRoleAction(formData);
}
export async function toggleUserDisabledActionVoid(formData: FormData): Promise<void> {
  await toggleUserDisabledAction(formData);
}
export async function rollbackPromptActionVoid(formData: FormData): Promise<void> {
  await rollbackPromptAction(formData);
}
export async function updateSettingsActionVoid(formData: FormData): Promise<void> {
  await updateSettingsAction(formData);
}
