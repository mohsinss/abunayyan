import { requireAdminApi } from "@/lib/auth/rbac";
import { buildUserExportBundle, exportFilename } from "@/lib/chatbots/user-export";
import { writeAudit } from "@/lib/chatbots/audit";
import { captureError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Admin-scoped export for any user. Produces the same JSON shape as
 * the self-export at /api/v1/me/export — the user can diff them to
 * confirm the data an admin sees matches what they can see themselves.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    const result = await buildUserExportBundle({
      userId: id,
      triggeredBy: guard.user.id,
      source: "admin",
    });
    if (!result) return new Response("Not Found", { status: 404 });

    await writeAudit({
      actorId: guard.user.id,
      targetUserId: id,
      event: "user.exported",
      payload: {
        source: "admin",
        threadCount: result.threadCount,
        messageCount: result.messageCount,
      },
    });

    const body = JSON.stringify(result.bundle, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename({
          email: result.bundle.user.email,
          id: result.bundle.user.id,
        })}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    captureError(err, { route: "admin.users.export", userId: id });
    return new Response("Export failed", { status: 500 });
  }
}
