import { requireAdminApi } from "@/lib/auth/rbac";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { threads } from "@/db/schema/threads";
import { messages } from "@/db/schema/messages";
import { auditLog } from "@/db/schema/audit-log";
import { eq, or, inArray } from "drizzle-orm";
import { writeAudit } from "@/lib/chatbots/audit";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GDPR-friendly data export for a single user. Returns a JSON bundle with
 * profile + every thread + every message + audit entries they authored or
 * were the target of. Admin-only. Also used when a user requests their own
 * data (future endpoint: /api/v1/me/export — thin wrapper).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return new Response("Not Found", { status: 404 });

  const userThreads = await db
    .select()
    .from(threads)
    .where(eq(threads.userId, id));

  const threadIds = userThreads.map((t) => t.id);

  const userMessages = threadIds.length
    ? await db.select().from(messages).where(inArray(messages.threadId, threadIds))
    : [];

  const userAudit = await db
    .select()
    .from(auditLog)
    .where(or(eq(auditLog.actorId, id), eq(auditLog.targetUserId, id)));

  // Record the export itself in the audit log so downloads are traceable.
  await writeAudit({
    actorId: guard.user.id,
    targetUserId: id,
    event: "settings.updated",
    payload: { kind: "user_export", threadCount: userThreads.length, messageCount: userMessages.length },
  });

  const bundle = {
    exportedAt: new Date().toISOString(),
    exportedBy: guard.user.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      disabled: user.disabled,
      createdAt: user.createdAt,
    },
    threads: userThreads,
    messages: userMessages,
    auditLog: userAudit,
  };

  const body = JSON.stringify(bundle, null, 2);
  const safeEmail = (user.email ?? user.id).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `user-${safeEmail}-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
