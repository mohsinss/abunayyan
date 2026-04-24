import Link from "next/link";
import { listUsers } from "@/lib/auth/queries";
import { USER_ROLES, type UserRole } from "@/db/schema/users";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; disabled?: string }>;
}) {
  const sp = await searchParams;
  const users = await listUsers({
    q: sp.q,
    roles: sp.role ? ([sp.role] as UserRole[]) : undefined,
    disabled: sp.disabled === "true" ? true : sp.disabled === "false" ? false : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Manage roles, disable accounts, and inspect conversations.
        </p>
      </header>

      <form className="flex items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name or email…"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <select
          name="role"
          defaultValue={sp.role ?? ""}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          name="disabled"
          defaultValue={sp.disabled ?? ""}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Any status</option>
          <option value="false">Active</option>
          <option value="true">Disabled</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Apply
        </button>
      </form>

      <div className="overflow-hidden rounded-md border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Signed up</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-neutral-500" colSpan={6}>
                  No users match those filters.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2">{u.name ?? "—"}</td>
                <td className="px-3 py-2">{u.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-3 py-2">
                  {u.disabled ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      Disabled
                    </span>
                  ) : (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-sm font-medium text-neutral-900 underline-offset-2 hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const color =
    role === "owner"
      ? "bg-amber-100 text-amber-800"
      : role === "admin"
        ? "bg-red-100 text-red-800"
        : role === "manager"
          ? "bg-blue-100 text-blue-800"
          : role === "viewer"
            ? "bg-neutral-100 text-neutral-600"
            : "bg-neutral-100 text-neutral-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{role}</span>;
}
