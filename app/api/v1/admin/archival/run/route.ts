import { requireAdminApi } from "@/lib/auth/rbac";
import { runArchivalSweep } from "@/lib/chatbots/archival";
import { getPlatformSettings } from "@/lib/chatbots/settings";
import { writeAudit } from "@/lib/chatbots/audit";
import { captureError } from "@/lib/logger";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z
  .object({
    archiveAfterDays: z.number().int().min(1).max(3650).optional(),
    pruneAfterDays: z.number().int().min(1).max(3650).optional(),
    batchSize: z.number().int().min(1).max(5000).optional(),
    maxBatches: z.number().int().min(1).max(50).optional(),
  })
  .default({});

/**
 * Manual admin-only trigger for the archival + retention sweep. Useful
 * in dev before QStash is configured, or for catch-up runs after
 * migrating a new tenant. Same underlying logic as the QStash cron.
 */
export async function POST(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const settings = await getPlatformSettings();
  try {
    const result = await runArchivalSweep({
      archiveAfterDays: body.archiveAfterDays ?? 180,
      pruneAfterDays: body.pruneAfterDays ?? settings.dataRetentionDays,
      batchSize: body.batchSize,
      maxBatches: body.maxBatches,
    });
    await writeAudit({
      actorId: guard.user.id,
      event: "archival.run",
      payload: {
        source: "admin-manual",
        ...result,
        archiveAfterDays: body.archiveAfterDays ?? 180,
        pruneAfterDays: body.pruneAfterDays ?? settings.dataRetentionDays,
      },
    });
    return Response.json(result);
  } catch (err) {
    captureError(err, { route: "admin.archival.run", userId: guard.user.id });
    await writeAudit({
      actorId: guard.user.id,
      event: "archival.failed",
      payload: { source: "admin-manual", error: (err as Error).message },
    });
    return Response.json(
      { error: "ARCHIVAL_FAILED", message: (err as Error).message },
      { status: 500 },
    );
  }
}
