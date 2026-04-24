import { auth } from "@/lib/auth";
import { ratelimit } from "@/lib/ratelimit";
import { buildUserExportBundle, exportFilename } from "@/lib/chatbots/user-export";
import { writeAudit } from "@/lib/chatbots/audit";
import { captureError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * User self-export (GDPR). Returns the same JSON bundle as the
 * admin endpoint — scoped to the authenticated user, nobody else.
 * Rate-limited hard (the existing `auth` bucket: 5 / 15 min) because
 * building the bundle is expensive and a repeat call exposes nothing
 * new until threads / messages change.
 */
export async function GET() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return new Response("Unauthorized", { status: 401 });
  if (user.disabled) return new Response("Disabled", { status: 403 });

  const rl = await ratelimit.auth.limit(`me:export:${user.id}`);
  if (!rl.success) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
        "X-RateLimit-Limit": String(rl.limit),
        "X-RateLimit-Remaining": String(rl.remaining),
        "X-RateLimit-Reset": String(rl.reset),
      },
    });
  }

  try {
    const result = await buildUserExportBundle({
      userId: user.id,
      triggeredBy: user.id,
      source: "self",
    });
    if (!result) return new Response("Not Found", { status: 404 });

    await writeAudit({
      actorId: user.id,
      targetUserId: user.id,
      event: "user.exported",
      payload: {
        source: "self",
        threadCount: result.threadCount,
        messageCount: result.messageCount,
      },
    });

    const body = JSON.stringify(result.bundle, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename({
          email: result.bundle.user.email,
          id: result.bundle.user.id,
        })}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    captureError(err, { route: "me.export", userId: user.id });
    return new Response("Export failed", { status: 500 });
  }
}
