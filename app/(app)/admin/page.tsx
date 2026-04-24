import { count, desc, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { chatbots } from "@/db/schema/chatbots";
import { auditLog } from "@/db/schema/audit-log";
import { messages } from "@/db/schema/messages";
import { ensurePlatformSettingsRow, getPlatformSettings } from "@/lib/chatbots/settings";
import { KillSwitchButton } from "@/components/admin/kill-switch-button";
import { ensureDefaultBotsSeeded } from "@/lib/chatbots/seed-defaults";

export const dynamic = "force-dynamic";

async function overviewStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[u], [b], [c], [s]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(chatbots),
    db.select({ n: count() }).from(auditLog).where(gte(auditLog.createdAt, since)),
    db
      .select({ cost: sql<number>`coalesce(sum(${messages.costUsd}), 0)` })
      .from(messages)
      .where(gte(messages.createdAt, since)),
  ]);

  return {
    users: u?.n ?? 0,
    chatbots: b?.n ?? 0,
    callsToday: c?.n ?? 0,
    spendTodayUsd: Number(s?.cost ?? 0),
  };
}

async function recentAudit() {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(15);
}

export default async function AdminOverviewPage() {
  await ensurePlatformSettingsRow();
  await ensureDefaultBotsSeeded();
  const [stats, audit, settings] = await Promise.all([
    overviewStats(),
    recentAudit(),
    getPlatformSettings(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="mt-1 text-sm text-neutral-600">Platform health at a glance.</p>
        </div>
        <KillSwitchButton enabled={settings.globalChatDisabled} />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={stats.users.toLocaleString()} />
        <StatCard label="Chatbots" value={stats.chatbots.toLocaleString()} />
        <StatCard label="Events (24h)" value={stats.callsToday.toLocaleString()} />
        <StatCard label="Spend (24h)" value={`$${stats.spendTodayUsd.toFixed(2)}`} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent activity
        </h2>
        <div className="overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {audit.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-neutral-500" colSpan={4}>
                    No audit entries yet. Activity will show here as admins and users act.
                  </td>
                </tr>
              )}
              {audit.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.event}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{row.actorId?.slice(0, 8) ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {row.targetUserId?.slice(0, 8) ?? row.botId?.slice(0, 8) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
