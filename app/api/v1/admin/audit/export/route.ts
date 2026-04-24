import { requireAdminApi } from "@/lib/auth/rbac";
import { db } from "@/db";
import { auditLog, AUDIT_EVENTS, type AuditEvent } from "@/db/schema/audit-log";
import { and, asc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { csvRow } from "@/lib/text/csv";
import { writeAudit } from "@/lib/chatbots/audit";

export const runtime = "nodejs";
// Long exports can legitimately take a while; use the max available.
export const maxDuration = 300;

const HEADER = [
  "created_at",
  "event",
  "actor_id",
  "target_user_id",
  "bot_id",
  "thread_id",
  "ip_address",
  "user_agent",
  "payload",
] as const;

// Paginate through the matching rows to keep memory flat on very large
// exports. 1000 rows / page is a good balance between round-trips and RAM.
const PAGE_SIZE = 1000;

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

  const baseConditions: SQL<unknown>[] = [];
  if (events.length) baseConditions.push(inArray(auditLog.event, events));
  if (actorId) baseConditions.push(eq(auditLog.actorId, actorId));
  if (botId) baseConditions.push(eq(auditLog.botId, botId));
  if (from) baseConditions.push(gte(auditLog.createdAt, new Date(from)));
  if (to) baseConditions.push(lte(auditLog.createdAt, new Date(to)));

  const fromIso = from ? new Date(from).toISOString().slice(0, 10) : "all";
  const toIso = to ? new Date(to).toISOString().slice(0, 10) : "now";
  const filename = `audit-${fromIso}-to-${toIso}.csv`;

  const encoder = new TextEncoder();
  let cursor: Date | null = null;
  let cursorId: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(csvRow(HEADER)));
    },
    async pull(controller) {
      // Keyset pagination on (createdAt, id) to avoid OFFSET.
      const conditions = [...baseConditions];
      if (cursor) {
        // Strictly greater than the cursor — for rows with identical
        // createdAt we fall back to id ordering.
        conditions.push(gte(auditLog.createdAt, cursor));
      }
      const rows = await db
        .select()
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(auditLog.createdAt), asc(auditLog.id))
        .limit(PAGE_SIZE);

      // Drop the last-cursor row to avoid double-emit.
      const fresh = cursor
        ? rows.filter((r) => !(r.id === cursorId && r.createdAt.getTime() === cursor!.getTime()))
        : rows;

      for (const r of fresh) {
        controller.enqueue(
          encoder.encode(
            csvRow([
              r.createdAt,
              r.event,
              r.actorId,
              r.targetUserId,
              r.botId,
              r.threadId,
              r.ipAddress,
              r.userAgent,
              r.payload,
            ]),
          ),
        );
      }

      if (fresh.length === 0 || rows.length < PAGE_SIZE) {
        controller.close();
        return;
      }
      const last = rows[rows.length - 1]!;
      cursor = last.createdAt;
      cursorId = last.id;
    },
  });

  // Audit the export itself — who downloaded what filter set, when.
  await writeAudit({
    actorId: guard.user.id,
    event: "settings.updated",
    payload: {
      kind: "audit_export",
      events,
      actorId,
      botId,
      from,
      to,
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
