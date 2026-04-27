import { requireAdminApi } from "@/lib/auth/rbac";
import { writeAudit } from "@/lib/chatbots/audit";
import { captureError } from "@/lib/logger";
import {
  getWorkingCapitalKbStatus,
  retrainWorkingCapitalKnowledge,
} from "@/lib/working-capital/retrain";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  try {
    const result = await retrainWorkingCapitalKnowledge(guard.user.id);
    await writeAudit({
      actorId: guard.user.id,
      botId: result.botId,
      event: "working_capital.retrained",
      payload: {
        datasetId: result.datasetId,
        inserted: result.inserted,
        deleted: result.deleted,
        unchanged: result.unchanged,
        embedded: result.embedded,
      },
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    captureError(err, { route: "admin.working-capital.retrain" });
    return new Response("Retrain failed", { status: 500 });
  }
}

export async function GET(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const status = await getWorkingCapitalKbStatus();
  return Response.json(status);
}
