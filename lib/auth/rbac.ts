import "server-only";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { ratelimit } from "@/lib/ratelimit";
import { USER_ROLES, type UserRole } from "@/db/schema/users";

const RANK: Record<UserRole, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function hasRole(role: UserRole | undefined, min: UserRole) {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.disabled) redirect("/sign-in?error=AccountDisabled");
  return session.user;
}

export async function requireRole(min: UserRole) {
  const user = await requireUser();
  if (!hasRole(user.role, min)) redirect("/dashboard?error=forbidden");
  return user;
}

type GuardOk = { ok: true; user: Session["user"] };
type GuardFail = { ok: false; response: Response };

export async function requireRoleOrRespond(min: UserRole): Promise<GuardOk | GuardFail> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }
  if (session.user.disabled) {
    return { ok: false, response: new Response("Disabled", { status: 403 }) };
  }
  if (!hasRole(session.user.role, min)) {
    return { ok: false, response: new Response("Forbidden", { status: 403 }) };
  }
  return { ok: true, user: session.user };
}

/**
 * Admin-API guard: requires admin+ role AND applies a per-method rate limit
 * (100/min for reads, 20/min for mutations). One call at the top of every
 * admin route handler.
 */
export async function requireAdminApi(req: Request): Promise<GuardOk | GuardFail> {
  const base = await requireRoleOrRespond("admin");
  if (!base.ok) return base;
  const method = req.method.toUpperCase();
  const limiter = method === "GET" || method === "HEAD" ? ratelimit.admin : ratelimit.adminMutations;
  const key = base.user.id ?? "anon";
  const rl = await limiter.limit(key);
  if (!rl.success) {
    return {
      ok: false,
      response: new Response("Rate limit exceeded", {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.reset),
        },
      }),
    };
  }
  return base;
}

/**
 * Encodes who may change another user's role. Returns a reason string when
 * the change is not permitted.
 */
export function canChangeRoleTo(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
  nextRole: UserRole,
): { ok: true } | { ok: false; reason: string } {
  if (!USER_ROLES.includes(nextRole)) return { ok: false, reason: "Unknown role" };
  if (actor.id === target.id && RANK[nextRole] < RANK["admin"]) {
    return { ok: false, reason: "Cannot self-demote below admin" };
  }
  // Only owner can touch admin/owner, or promote to admin/owner.
  const touchesPrivileged =
    RANK[target.role] >= RANK["admin"] || RANK[nextRole] >= RANK["admin"];
  if (touchesPrivileged && actor.role !== "owner") {
    return { ok: false, reason: "Only owner may change admin/owner roles" };
  }
  if (nextRole === "owner" && actor.role !== "owner") {
    return { ok: false, reason: "Only owner may create owner" };
  }
  return { ok: true };
}
