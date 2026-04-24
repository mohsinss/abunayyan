import Link from "next/link";
import { count, eq, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db";
import { threads } from "@/db/schema/threads";
import { messages } from "@/db/schema/messages";
import { auditLog } from "@/db/schema/audit-log";

export const metadata = { title: "Account" };
export const dynamic = "force-dynamic";

async function myStats(userId: string) {
  const [t] = await db
    .select({ n: count() })
    .from(threads)
    .where(eq(threads.userId, userId));
  const [m] = await db
    .select({
      n: count(),
      spendUsd: sql<number>`coalesce(sum(${messages.costUsd}), 0)`,
    })
    .from(messages)
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(eq(threads.userId, userId));
  const [a] = await db
    .select({ n: count() })
    .from(auditLog)
    .where(or(eq(auditLog.actorId, userId), eq(auditLog.targetUserId, userId)));
  return {
    threads: t?.n ?? 0,
    messages: m?.n ?? 0,
    spendUsd: Number(m?.spendUsd ?? 0),
    auditEntries: a?.n ?? 0,
  };
}

export default async function AccountSettingsPage() {
  const user = await requireUser();
  const stats = await myStats(user.id);

  return (
    <div className="container max-w-3xl py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Account</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Your profile, data, and privacy controls.
        </p>
      </header>

      <section className="mb-8 rounded-md border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Profile
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Name</dt>
            <dd className="mt-0.5 text-neutral-900">{user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Email</dt>
            <dd className="mt-0.5 text-neutral-900">{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Role</dt>
            <dd className="mt-0.5 text-neutral-900">{user.role}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Access plan</dt>
            <dd className="mt-0.5 text-neutral-900">
              {user.hasAccess ? "Active subscription" : "No active plan"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Threads" value={stats.threads.toLocaleString()} />
        <Stat label="Messages" value={stats.messages.toLocaleString()} />
        <Stat label="Spend (USD)" value={`$${stats.spendUsd.toFixed(3)}`} />
        <Stat label="Audit entries" value={stats.auditEntries.toLocaleString()} />
      </section>

      <section className="mb-8 rounded-md border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Your data
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Download a JSON bundle of everything we hold about you: profile,
          every thread and message, and audit entries you authored or were
          the target of. GDPR-compliant. Rate-limited (5 requests / 15 min).
        </p>
        <div className="mt-4 flex items-center gap-3">
          <a
            href="/api/v1/me/export"
            download
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Export my data
          </a>
          <span className="text-xs text-neutral-500">
            Returns <code className="rounded bg-neutral-100 px-1">application/json</code>;
            your browser will save it as a file.
          </span>
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Quick links
        </h2>
        <ul className="mt-2 space-y-1">
          <li>
            <Link href="/chat" className="text-neutral-900 underline-offset-2 hover:underline">
              Your chats →
            </Link>
          </li>
          <li>
            <Link href="/billing" className="text-neutral-900 underline-offset-2 hover:underline">
              Billing →
            </Link>
          </li>
          <li>
            <Link href="/dashboard" className="text-neutral-900 underline-offset-2 hover:underline">
              Dashboard →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
