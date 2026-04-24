import { captureError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handler(req: Request) {
  try {
    const { job, payload } = (await req.json()) as { job: string; payload: unknown };

    switch (job) {
      case "send-welcome-email": {
        const { sendWelcomeEmail } = await import("@/lib/email/resend");
        await sendWelcomeEmail(payload as { to: string; name: string | null });
        break;
      }
      case "archive-old-messages": {
        const { runArchivalSweep } = await import("@/lib/chatbots/archival");
        const { getPlatformSettings } = await import("@/lib/chatbots/settings");
        const { writeAudit } = await import("@/lib/chatbots/audit");
        const opts =
          (payload as {
            archiveAfterDays?: number;
            pruneAfterDays?: number;
            batchSize?: number;
            maxBatches?: number;
          }) ?? {};
        const settings = await getPlatformSettings();
        try {
          const result = await runArchivalSweep({
            archiveAfterDays: opts.archiveAfterDays ?? 180,
            pruneAfterDays: opts.pruneAfterDays ?? settings.dataRetentionDays,
            batchSize: opts.batchSize,
            maxBatches: opts.maxBatches,
          });
          await writeAudit({
            event: "archival.run",
            payload: {
              source: "qstash",
              ...result,
              archiveAfterDays: opts.archiveAfterDays ?? 180,
              pruneAfterDays: opts.pruneAfterDays ?? settings.dataRetentionDays,
            },
          });
        } catch (err) {
          await writeAudit({
            event: "archival.failed",
            payload: { source: "qstash", error: (err as Error).message },
          });
          throw err;
        }
        break;
      }
      default:
        return new Response(`Unknown job: ${job}`, { status: 400 });
    }

    return new Response(null, { status: 200 });
  } catch (err) {
    captureError(err, { flow: "qstash-handler" });
    return new Response("Handler error", { status: 500 });
  }
}

// Lazy-import so the signature verifier doesn't read env at module-load time
// (important for `next build` when QSTASH keys may be absent).
export async function POST(req: Request) {
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return new Response("QStash not configured", { status: 503 });
  }
  const { verifySignatureAppRouter } = await import("@upstash/qstash/nextjs");
  return verifySignatureAppRouter(handler)(req);
}
