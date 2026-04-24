import "server-only";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, USER_ROLES, type UserRole } from "@/db/schema/users";
import { threads } from "@/db/schema/threads";
import { messages } from "@/db/schema/messages";

export async function listUsers(opts: {
  q?: string;
  roles?: UserRole[];
  disabled?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  const conditions = [];
  if (opts.q) {
    const needle = `%${opts.q}%`;
    conditions.push(or(ilike(users.name, needle), ilike(users.email, needle)));
  }
  if (opts.roles && opts.roles.length) {
    conditions.push(inArray(users.role, opts.roles));
  }
  if (typeof opts.disabled === "boolean") {
    conditions.push(eq(users.disabled, opts.disabled));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  return db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function getUserById(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function updateUserRole(args: {
  userId: string;
  role: UserRole;
}) {
  if (!USER_ROLES.includes(args.role)) throw new Error("Invalid role");
  await db.update(users).set({ role: args.role, updatedAt: new Date() }).where(eq(users.id, args.userId));
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  await db
    .update(users)
    .set({ disabled, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function userStats(userId: string) {
  const [t] = await db
    .select({ n: count() })
    .from(threads)
    .where(eq(threads.userId, userId));
  const [m] = await db
    .select({
      n: count(),
      tokensIn: sql<number>`coalesce(sum(${messages.tokensIn}), 0)::int`,
      tokensOut: sql<number>`coalesce(sum(${messages.tokensOut}), 0)::int`,
      spendUsd: sql<number>`coalesce(sum(${messages.costUsd}), 0)`,
    })
    .from(messages)
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(eq(threads.userId, userId));
  return {
    threads: t?.n ?? 0,
    messages: m?.n ?? 0,
    tokensIn: m?.tokensIn ?? 0,
    tokensOut: m?.tokensOut ?? 0,
    spendUsd: m?.spendUsd ?? 0,
  };
}
