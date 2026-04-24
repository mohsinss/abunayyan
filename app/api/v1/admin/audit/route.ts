import { requireAdminApi } from "@/lib/auth/rbac";
import { db } from "@/db";
import { auditLog, AUDIT_EVENTS, type AuditEvent } from "@/db/schema/audit-log";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";

export async function GET(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const events = url.searchParams.getAll("event").filter((e): e is AuditEvent =>
    (AUDIT_EVENTS as readonly string[]).includes(e),
  );
  const actorId = url.searchParams.get("actorId");
  const botId = url.searchParams.get("botId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  const conditions = [];
  if (events.length) conditions.push(inArray(auditLog.event, events));
  if (actorId) conditions.push(eq(auditLog.actorId, actorId));
  if (botId) conditions.push(eq(auditLog.botId, botId));
  if (from) conditions.push(gte(auditLog.createdAt, new Date(from)));
  if (to) conditions.push(lte(auditLog.createdAt, new Date(to)));

  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return Response.json({ entries: rows });
}
