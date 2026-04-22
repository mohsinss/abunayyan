import { auth } from "@/lib/auth";
import { streamText, convertToCoreMessages, type UIMessage } from "ai";
import { models } from "@/lib/ai/client";
import { systemMessage } from "@/lib/ai/prompts/system";
import { buildTools } from "@/lib/ai/tools";
import { ratelimit } from "@/lib/ratelimit";
import { capture, EVENTS } from "@/lib/analytics/posthog";
import { captureError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { success } = await ratelimit.ai.limit(userId);
  if (!success) return new Response("Rate limit exceeded", { status: 429 });

  try {
    const { messages } = (await req.json()) as { messages: UIMessage[] };

    const result = streamText({
      model: models.default,
      messages: [systemMessage, ...convertToCoreMessages(messages)],
      tools: buildTools(userId),
      maxSteps: 5,
      experimental_telemetry: { isEnabled: true, functionId: "chat" },
      onFinish: async ({ usage, finishReason }) => {
        await capture({
          distinctId: userId,
          event: EVENTS.ai_completion,
          properties: {
            model: "claude-sonnet-4-6",
            input_tokens: usage.promptTokens,
            output_tokens: usage.completionTokens,
            finish_reason: finishReason,
          },
        }).catch(() => {});
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    captureError(err, { route: "ai/chat" });
    return new Response("AI chat failed", { status: 500 });
  }
}
