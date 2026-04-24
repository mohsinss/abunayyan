import "server-only";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getBotBySlug } from "./registry";
import { runBotStream } from "./runtime";
import { captureError } from "@/lib/logger";

const BodySchema = z.object({
  messages: z.array(z.unknown()).min(1),
  threadId: z.string().uuid().optional(),
});

/**
 * Shared chat-request handler used by the canonical `/api/v1/chatbots/[slug]/chat`
 * route AND by the deprecated `/api/v1/ai/chat` / `/api/v1/ai/atlas-chat` proxy
 * routes. One place to audit, one place to patch.
 */
export async function handleChatRequest(req: Request, slug: string): Promise<Response> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return new Response("Unauthorized", { status: 401 });
  if (user.disabled) return new Response("Disabled", { status: 403 });

  const bot = await getBotBySlug(slug);
  if (!bot) return new Response("Not Found", { status: 404 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    const result = await runBotStream({
      bot,
      user: { id: user.id, role: user.role, disabled: user.disabled },
      threadId: body.threadId,
      messages: body.messages as Parameters<typeof runBotStream>[0]["messages"],
    });

    if (!result.ok) {
      switch (result.error.kind) {
        case "unauthorized":
          return new Response("Forbidden", { status: 403 });
        case "rate_limited":
          return new Response("Rate limit exceeded", {
            status: 429,
            headers: {
              "Retry-After": String(result.error.retryAfterSec),
              "X-RateLimit-Limit": String(result.error.limit),
              "X-RateLimit-Remaining": String(result.error.remaining),
              "X-RateLimit-Reset": String(result.error.reset),
            },
          });
        case "budget_exceeded":
          return new Response("Budget exceeded", {
            status: 402,
            headers: {
              "X-Budget-Cap-Usd": String(result.error.capUsd),
              "X-Budget-Spent-Usd": String(result.error.spentUsd),
            },
          });
        case "bot_disabled":
        case "global_disabled":
          return new Response("Service unavailable", {
            status: 503,
            headers: { "Retry-After": "30" },
          });
      }
    }

    return result.result.toDataStreamResponse({
      headers: { "X-Thread-Id": result.threadId },
      getErrorMessage: (err) => {
        if (err == null) return "Unknown error";
        if (typeof err === "string") return err;
        if (err instanceof Error) return err.message;
        try {
          return JSON.stringify(err);
        } catch {
          return String(err);
        }
      },
    });
  } catch (err) {
    captureError(err, { route: "chatbots.chat", slug });
    return new Response("Chat failed", { status: 500 });
  }
}
