import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { sessions } from "@/db/schema/sessions";
import { ratelimit } from "@/lib/ratelimit";
import { writeAudit } from "@/lib/chatbots/audit";
import { captureError } from "@/lib/logger";

export const runtime = "nodejs";

const BodySchema = z.object({
  confirmEmail: z.string().min(1),
});

/**
 * User self-disable. Soft-delete only — flips `users.disabled` to true,
 * deletes every active session for the user (immediate logout on the
 * next request), and audits the event. Data is preserved so an admin
 * can reverse the action; the existing retention sweep does the
 * eventual hard-delete.
 *
 * Confirmation: client must POST the user's exact email so a misfire
 * (e.g., wired-up button on a hover) cannot accidentally disable an
 * account. The only-owner guard prevents the platform from being
 * locked out by an owner self-deleting.
 *
 * Rate-limited via the `auth` bucket (5 / 15 min) — irreversible-ish
 * action that doesn't need to be hot.
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return new Response("Unauthorized", { status: 401 });
  if (user.disabled) {
    // Already disabled — idempotent success.
    return Response.json({ ok: true, redirectTo: "/sign-in?error=AccountDisabled" });
  }

  const rl = await ratelimit.auth.limit(`me:delete:${user.id}`);
  if (!rl.success) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
      },
    });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const expected = (user.email ?? "").trim().toLowerCase();
  const got = body.confirmEmail.trim().toLowerCase();
  if (!expected || got !== expected) {
    return Response.json(
      { error: "EMAIL_MISMATCH", message: "Type your account email exactly to confirm." },
      { status: 400 },
    );
  }

  // Don't let the only owner self-delete: the platform would lose
  // ownership-level access entirely.
  if (user.role === "owner") {
    const owners = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.disabled, false)));
    if (owners.length <= 1) {
      return Response.json(
        {
          error: "LAST_OWNER",
          message:
            "You are the only active owner. Promote another user to owner first, then try again.",
        },
        { status: 409 },
      );
    }
  }

  try {
    await db
      .update(users)
      .set({ disabled: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await db.delete(sessions).where(eq(sessions.userId, user.id));

    await writeAudit({
      actorId: user.id,
      targetUserId: user.id,
      event: "user.self_deleted",
      payload: { email: user.email, role: user.role },
    });

    return Response.json({ ok: true, redirectTo: "/sign-in?error=AccountDisabled" });
  } catch (err) {
    captureError(err, { route: "me.delete", userId: user.id });
    return new Response("Delete failed", { status: 500 });
  }
}
