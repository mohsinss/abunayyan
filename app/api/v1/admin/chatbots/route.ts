import { requireAdminApi } from "@/lib/auth/rbac";
import { listBots } from "@/lib/chatbots/registry";
import { createChatbot } from "@/lib/chatbots/admin-queries";
import { writeAudit } from "@/lib/chatbots/audit";
import { resolveModel, ProviderNotConfiguredError, UnsupportedModelError } from "@/lib/chatbots/providers";
import { ChatbotUpsertSchema } from "@/lib/validation/chatbot";

export async function GET(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const chatbots = await listBots();
  return Response.json({ chatbots });
}

export async function POST(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const parsed = ChatbotUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    resolveModel(parsed.data.provider, parsed.data.modelId);
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) {
      return Response.json({ error: "PROVIDER_NOT_CONFIGURED", message: e.message }, { status: 422 });
    }
    if (e instanceof UnsupportedModelError) {
      return Response.json({ error: "UNSUPPORTED_MODEL", message: e.message }, { status: 422 });
    }
    throw e;
  }

  try {
    const created = await createChatbot(
      {
        ...parsed.data,
        description: parsed.data.description ?? null,
        createdBy: guard.user.id,
      },
      guard.user.id,
    );
    await writeAudit({
      actorId: guard.user.id,
      botId: created.id,
      event: "bot.created",
      payload: { slug: created.slug, provider: created.provider, modelId: created.modelId },
    });
    return Response.json({ chatbot: created }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("unique")) {
      return Response.json({ error: "CONFLICT", message: "slug already in use" }, { status: 409 });
    }
    throw e;
  }
}
