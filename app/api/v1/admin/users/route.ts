import { requireAdminApi } from "@/lib/auth/rbac";
import { listUsers } from "@/lib/auth/queries";
import type { UserRole } from "@/db/schema/users";

export async function GET(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const roleParams = url.searchParams.getAll("role") as UserRole[];
  const disabledStr = url.searchParams.get("disabled");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const users = await listUsers({
    q,
    roles: roleParams.length ? roleParams : undefined,
    disabled: disabledStr === "true" ? true : disabledStr === "false" ? false : undefined,
    limit,
    offset,
  });
  return Response.json({ users });
}
