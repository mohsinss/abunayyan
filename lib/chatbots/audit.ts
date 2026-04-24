import "server-only";
import { db } from "@/db";
import { auditLog, type AuditEvent } from "@/db/schema/audit-log";

export async function writeAudit(entry: {
  actorId?: string | null;
  targetUserId?: string | null;
  botId?: string | null;
  threadId?: string | null;
  event: AuditEvent;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId ?? null,
      targetUserId: entry.targetUserId ?? null,
      botId: entry.botId ?? null,
      threadId: entry.threadId ?? null,
      event: entry.event,
      payload: entry.payload ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch {
    // Audit must not break the request flow. The outer code catches via captureError.
  }
}
