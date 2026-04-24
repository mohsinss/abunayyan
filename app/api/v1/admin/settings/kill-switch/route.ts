import { requireAdminApi } from "@/lib/auth/rbac";
import { ensurePlatformSettingsRow } from "@/lib/chatbots/settings";
import { writeAudit } from "@/lib/chatbots/audit";
import { db } from "@/db";
import { platformSettings } from "@/db/schema/platform-settings";
import { eq } from "drizzle-orm";
import { z } from "zod";

const BodySchema = z.object({ enabled: z.boolean() });

export async function POST(req: Request) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  await ensurePlatformSettingsRow();

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  await db
    .update(platformSettings)
    .set({
      globalChatDisabled: body.enabled,
      updatedAt: new Date(),
      updatedBy: guard.user.id,
    })
    .where(eq(platformSettings.id, 1));

  await writeAudit({
    actorId: guard.user.id,
    event: "settings.kill_switch_toggled",
    payload: { enabled: body.enabled },
  });

  return Response.json({ enabled: body.enabled });
}
