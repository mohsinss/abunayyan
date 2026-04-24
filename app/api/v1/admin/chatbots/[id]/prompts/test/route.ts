import { requireAdminApi } from "@/lib/auth/rbac";
import { getBotById } from "@/lib/chatbots/registry";
import { resolveModel } from "@/lib/chatbots/providers";
import { generateText } from "ai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  userMessage: z.string().min(1).max(2000),
  systemPrompt: z.string().max(32_000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const bot = await getBotById(id);
  if (!bot) return new Response("Not Found", { status: 404 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const model = resolveModel(bot.provider, bot.modelId);
  const res = await generateText({
    model,
    system: body.systemPrompt ?? bot.systemPrompt,
    messages: [{ role: "user", content: body.userMessage }],
    temperature: bot.temperature,
    maxTokens: 512,
  });

  return Response.json({
    text: res.text,
    usage: res.usage,
    finishReason: res.finishReason,
  });
}
