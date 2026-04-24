import { z } from "zod";
import { getBotById } from "@/lib/chatbots/registry";
import { getDatasetByShareToken } from "@/lib/db/queries/datasets";
import { runPublicBotStream } from "@/lib/datasets/public-chat";
import { captureError } from "@/lib/logger";
import { capture, EVENTS } from "@/lib/analytics/posthog";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({ messages: z.array(z.unknown()).min(1) });

// Pulls the client IP off common headers. Falls back to "anon" when nothing
// usable is present (local dev + obscure proxies). Rate limit still works
// per-card even if the IP collapses to "anon".
function clientIpFrom(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "anon";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const dataset = await getDatasetByShareToken(token);
  if (!dataset) return new Response("Not Found", { status: 404 });
  if (!dataset.chatbotId) return new Response("Not Found", { status: 404 });

  const bot = await getBotById(dataset.chatbotId);
  if (!bot) return new Response("Not Found", { status: 404 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const clientIp = clientIpFrom(req);
  try {
    const result = await runPublicBotStream({
      bot,
      datasetId: dataset.id,
      clientIp,
      messages: body.messages as Parameters<typeof runPublicBotStream>[0]["messages"],
    });

    if (!result.ok) {
      switch (result.error.kind) {
        case "unauthorized":
        case "bot_disabled":
          return new Response("Forbidden", { status: 403 });
        case "global_disabled":
          return new Response("Service unavailable", {
            status: 503,
            headers: { "Retry-After": "30" },
          });
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
      }
    }

    // Fire-and-forget event. We don't block the stream on PostHog.
    capture({
      distinctId: `anon:${clientIp}`,
      event: EVENTS.dataset_public_chat_sent,
      properties: { datasetId: dataset.id, botId: bot.id },
    }).catch(() => {});

    return result.result.toDataStreamResponse({
      getErrorMessage: (err) => {
        if (err instanceof Error) return err.message;
        if (typeof err === "string") return err;
        return "Unknown error";
      },
    });
  } catch (err) {
    captureError(err, { route: "public-chat", token });
    return new Response("Chat failed", { status: 500 });
  }
}
