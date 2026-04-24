import { requireAdminApi, canChangeRoleTo } from "@/lib/auth/rbac";
import { getUserById, setUserDisabled, updateUserRole, userStats } from "@/lib/auth/queries";
import { writeAudit } from "@/lib/chatbots/audit";
import { USER_ROLES, type UserRole } from "@/db/schema/users";
import { z } from "zod";

const PatchSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  disabled: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const user = await getUserById(id);
  if (!user) return new Response("Not Found", { status: 404 });
  const stats = await userStats(id);
  return Response.json({ user, stats });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const target = await getUserById(id);
  if (!target) return new Response("Not Found", { status: 404 });

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const actor = { id: guard.user.id, role: guard.user.role };

  if (body.role && body.role !== target.role) {
    const allowed = canChangeRoleTo(actor, { id: target.id, role: target.role }, body.role);
    if (!allowed.ok) {
      return Response.json({ error: allowed.reason }, { status: 403 });
    }
    await updateUserRole({ userId: id, role: body.role as UserRole });
    await writeAudit({
      actorId: actor.id,
      targetUserId: id,
      event: "user.role_changed",
      payload: { before: target.role, after: body.role },
    });
  }

  if (typeof body.disabled === "boolean" && body.disabled !== target.disabled) {
    await setUserDisabled(id, body.disabled);
    await writeAudit({
      actorId: actor.id,
      targetUserId: id,
      event: "user.disabled_changed",
      payload: { before: target.disabled, after: body.disabled },
    });
  }

  const updated = await getUserById(id);
  return Response.json({ user: updated });
}
