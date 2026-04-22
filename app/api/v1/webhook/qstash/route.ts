import { captureError } from "@/lib/logger";

export const runtime = "nodejs";

async function handler(req: Request) {
  try {
    const { job, payload } = (await req.json()) as { job: string; payload: unknown };

    switch (job) {
      case "send-welcome-email": {
        const { sendWelcomeEmail } = await import("@/lib/email/resend");
        await sendWelcomeEmail(payload as { to: string; name: string | null });
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
