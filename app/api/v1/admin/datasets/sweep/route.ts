import { requireAdminApi } from "@/lib/auth/rbac";
import { captureError } from "@/lib/logger";
import { writeAudit } from "@/lib/chatbots/audit";
import { runDatasetSweep } from "@/lib/datasets/sweep";

export const runtime = "nodejs";
export const maxDuration = 300;

// Manual trigger for the 30-day hard-delete sweep. The production path is
// QStash → /api/v1/webhook/qstash with job=sweep-deleted-datasets. This
// endpoint exists so admins (and ops runbooks) can force a sweep without
// waiting for the schedule.
export async function POST(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  let retentionDays: number | undefined;
  try {
    const body = (await req.json()) as { retentionDays?: number } | null;
    if (body?.retentionDays !== undefined && typeof body.retentionDays === "number") {
      retentionDays = body.retentionDays;
    }
  } catch {
    // empty body is fine
  }

  try {
    const result = await runDatasetSweep({ retentionDays });
    await writeAudit({
      actorId: guard.user.id,
      event: "dataset.sweep_manual",
      payload: { ...result, retentionDays: retentionDays ?? 30, source: "admin" },
    });
    return Response.json(result);
  } catch (err) {
    captureError(err, { route: "datasets.sweep.admin" });
    return new Response("Sweep failed", { status: 500 });
  }
}
