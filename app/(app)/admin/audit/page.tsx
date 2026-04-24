import { db } from "@/db";
import { auditLog, AUDIT_EVENTS, type AuditEvent } from "@/db/schema/audit-log";
import { desc, and, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawEvents = Array.isArray(sp.event) ? sp.event : sp.event ? [sp.event] : [];
  const events = rawEvents.filter((e): e is AuditEvent =>
    (AUDIT_EVENTS as readonly string[]).includes(e),
  );

  const where =
    events.length === 0
      ? undefined
      : and(inArray(auditLog.event, events));
  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  const exportHref = `/api/v1/admin/audit/export${events.length ? `?${events.map((e) => `event=${encodeURIComponent(e)}`).join("&")}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Every security-relevant action and every chat turn is recorded here.
          </p>
        </div>
        <a
          href={exportHref}
          download
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
        >
          Export CSV
        </a>
      </header>

      <form className="flex flex-wrap gap-2">
        {AUDIT_EVENTS.map((e) => {
          const active = events.includes(e);
          return (
            <label
              key={e}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <input
                type="checkbox"
                name="event"
                value={e}
                defaultChecked={active}
                className="hidden"
              />
              {e}
            </label>
          );
        })}
        <button
          type="submit"
          className="ml-2 rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white"
        >
          Apply
        </button>
      </form>

      <div className="overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Bot</th>
              <th className="px-3 py-2">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-neutral-500" colSpan={6}>
                  No events match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-500">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.event}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.actorId?.slice(0, 8) ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.targetUserId?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.botId?.slice(0, 8) ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.payload && (
                    <details>
                      <summary className="cursor-pointer text-xs text-neutral-600">
                        view
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-neutral-50 p-2 font-mono text-[11px]">
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
