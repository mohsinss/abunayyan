import { requireAdminApi } from "@/lib/auth/rbac";
import { getBotById } from "@/lib/chatbots/registry";
import { softDeleteChatbot, updateChatbot } from "@/lib/chatbots/admin-queries";
import { updateSystemPrompt } from "@/lib/chatbots/prompts";
import { writeAudit } from "@/lib/chatbots/audit";
import { resolveModel, ProviderNotConfiguredError, UnsupportedModelError } from "@/lib/chatbots/providers";
import { ChatbotPatchSchema } from "@/lib/validation/chatbot";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const bot = await getBotById(id);
  if (!bot) return new Response("Not Found", { status: 404 });
  return Response.json({ chatbot: bot });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const existing = await getBotById(id);
  if (!existing) return new Response("Not Found", { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const parsed = ChatbotPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const patch = parsed.data;

  if (patch.provider || patch.modelId) {
    const provider = patch.provider ?? existing.provider;
    const modelId = patch.modelId ?? existing.modelId;
    try {
      resolveModel(provider, modelId);
    } catch (e) {
      if (e instanceof ProviderNotConfiguredError) {
        return Response.json({ error: "PROVIDER_NOT_CONFIGURED", message: e.message }, { status: 422 });
      }
      if (e instanceof UnsupportedModelError) {
        return Response.json({ error: "UNSUPPORTED_MODEL", message: e.message }, { status: 422 });
      }
      throw e;
    }
  }

  // Prompt edits go through the versioning pipeline.
  if (patch.systemPrompt !== undefined && patch.systemPrompt !== existing.systemPrompt) {
    await updateSystemPrompt({
      botId: id,
      newPrompt: patch.systemPrompt,
      actorId: guard.user.id,
    });
    delete patch.systemPrompt;
  }

  if (Object.keys(patch).length > 0) {
    await updateChatbot(id, {
      ...patch,
      description: patch.description === undefined ? undefined : patch.description ?? null,
    });
  }

  await writeAudit({
    actorId: guard.user.id,
    botId: id,
    event: "bot.updated",
    payload: { changedFields: Object.keys(parsed.data) },
  });

  const updated = await getBotById(id);
  return Response.json({ chatbot: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const bot = await getBotById(id);
  if (!bot) return new Response("Not Found", { status: 404 });
  await softDeleteChatbot(id);
  await writeAudit({
    actorId: guard.user.id,
    botId: id,
    event: "bot.deleted",
    payload: { slug: bot.slug },
  });
  return new Response(null, { status: 204 });
}
