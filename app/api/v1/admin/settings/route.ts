import { requireAdminApi } from "@/lib/auth/rbac";
import { getPlatformSettings, ensurePlatformSettingsRow } from "@/lib/chatbots/settings";
import { writeAudit } from "@/lib/chatbots/audit";
import { db } from "@/db";
import { platformSettings, SIGNUP_POLICIES } from "@/db/schema/platform-settings";
import { AI_PROVIDERS } from "@/db/schema/chatbots";
import { eq } from "drizzle-orm";
import { z } from "zod";

const PatchSchema = z.object({
  globalChatDisabled: z.boolean().optional(),
  defaultRateLimitTokens: z.number().int().min(1).max(10_000).optional(),
  defaultRateLimitWindow: z.enum(["1 m", "5 m", "15 m", "1 h", "1 d"]).optional(),
  defaultDailyCostCapUsd: z.number().min(0).max(10_000).optional(),
  fallbackProvider: z.enum(AI_PROVIDERS).nullable().optional(),
  signupPolicy: z.enum(SIGNUP_POLICIES).optional(),
  dataRetentionDays: z.number().int().min(1).max(3650).optional(),
  brandName: z.string().min(1).max(64).optional(),
  brandPrimaryColor: z.string().max(16).nullable().optional(),
});

export async function GET(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  await ensurePlatformSettingsRow();
  const settings = await getPlatformSettings();
  return Response.json({ settings });
}

export async function PATCH(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  await ensurePlatformSettingsRow();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await db
    .update(platformSettings)
    .set({ ...parsed.data, updatedAt: new Date(), updatedBy: guard.user.id })
    .where(eq(platformSettings.id, 1));

  await writeAudit({
    actorId: guard.user.id,
    event: "settings.updated",
    payload: { changedFields: Object.keys(parsed.data) },
  });

  const settings = await getPlatformSettings();
  return Response.json({ settings });
}
