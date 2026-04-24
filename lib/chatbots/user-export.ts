import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema/users";
import { threads } from "@/db/schema/threads";
import { messages } from "@/db/schema/messages";
import { auditLog } from "@/db/schema/audit-log";

export type UserExportBundle = {
  exportedAt: string;
  exportedBy: string; // self-id when the user triggered it, admin id otherwise
  source: "self" | "admin";
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: User["role"];
    disabled: boolean;
    createdAt: Date;
  };
  threads: (typeof threads.$inferSelect)[];
  messages: (typeof messages.$inferSelect)[];
  auditLog: (typeof auditLog.$inferSelect)[];
};

/**
 * Assemble a GDPR-ready JSON bundle of everything we hold about a single
 * user: profile, threads, messages, and every audit entry they authored
 * or were the target of. Shared between the admin-scoped export
 * (/api/v1/admin/users/[id]/export) and the self-scoped export
 * (/api/v1/me/export) so both produce identical JSON shape.
 */
export async function buildUserExportBundle(args: {
  userId: string;
  triggeredBy: string;
  source: "self" | "admin";
}): Promise<{ bundle: UserExportBundle; threadCount: number; messageCount: number } | null> {
  const [user] = await db.select().from(users).where(eq(users.id, args.userId)).limit(1);
  if (!user) return null;

  const userThreads = await db
    .select()
    .from(threads)
    .where(eq(threads.userId, args.userId));

  const threadIds = userThreads.map((t) => t.id);

  const userMessages = threadIds.length
    ? await db.select().from(messages).where(inArray(messages.threadId, threadIds))
    : [];

  const userAudit = await db
    .select()
    .from(auditLog)
    .where(
      or(eq(auditLog.actorId, args.userId), eq(auditLog.targetUserId, args.userId)),
    );

  const bundle: UserExportBundle = {
    exportedAt: new Date().toISOString(),
    exportedBy: args.triggeredBy,
    source: args.source,
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

  return {
    bundle,
    threadCount: userThreads.length,
    messageCount: userMessages.length,
  };
}

export function exportFilename(user: { email: string | null; id: string }): string {
  const safe = (user.email ?? user.id).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `user-${safe}-${new Date().toISOString().slice(0, 10)}.json`;
}
