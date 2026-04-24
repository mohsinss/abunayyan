import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserById, userStats } from "@/lib/auth/queries";
import { listThreadsForUser } from "@/lib/chatbots/persistence";
import { listBots } from "@/lib/chatbots/registry";
import { USER_ROLES } from "@/db/schema/users";
import {
  changeUserRoleActionVoid,
  toggleUserDisabledActionVoid,
} from "@/app/(app)/admin/actions";
import { requireRole } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole("admin");
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();
  const [stats, threads, bots] = await Promise.all([
    userStats(id),
    listThreadsForUser(id, { limit: 50 }),
    listBots(),
  ]);
  const botMap = new Map(bots.map((b) => [b.id, b]));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-wide text-neutral-500">
            <Link href="/admin/users" className="hover:underline">
              Users
            </Link>{" "}
            / {user.email ?? user.id.slice(0, 8)}
          </div>
          <h1 className="mt-1 text-2xl font-semibold">{user.name ?? user.email ?? user.id}</h1>
          <p className="mt-1 text-sm text-neutral-600">{user.email}</p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Threads" value={stats.threads.toString()} />
        <Stat label="Messages" value={stats.messages.toString()} />
        <Stat label="Tokens" value={(stats.tokensIn + stats.tokensOut).toLocaleString()} />
        <Stat label="Spend" value={`$${stats.spendUsd.toFixed(3)}`} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border border-neutral-200 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Role</h2>
          <form action={changeUserRoleActionVoid} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <select
              name="role"
              defaultValue={user.role}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Save
            </button>
          </form>
          <p className="mt-2 text-xs text-neutral-500">
            Only the owner may promote to admin/owner. You are {actor.role}.
          </p>
        </div>

        <div className="rounded-md border border-neutral-200 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Status</h2>
          <form action={toggleUserDisabledActionVoid} className="mt-3 flex items-center gap-3">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="disabled" value={user.disabled ? "false" : "true"} />
            <span className="text-sm">
              Currently{" "}
              <strong>{user.disabled ? "disabled" : "active"}</strong>.
            </span>
            <button
              type="submit"
              className={`ml-auto rounded-md px-3 py-2 text-sm font-medium text-white ${
                user.disabled ? "bg-green-700 hover:bg-green-800" : "bg-red-700 hover:bg-red-800"
              }`}
            >
              {user.disabled ? "Re-enable" : "Disable account"}
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Conversations
        </h2>
        <div className="overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Bot</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {threads.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-neutral-500" colSpan={4}>
                    No conversations yet.
                  </td>
                </tr>
              )}
              {threads.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">{t.title ?? "(untitled)"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-600">
                    {botMap.get(t.chatbotId)?.slug ?? t.chatbotId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                    {new Date(t.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/users/${user.id}/threads/${t.id}`}
                      className="text-sm font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      Open →
                    </Link>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
