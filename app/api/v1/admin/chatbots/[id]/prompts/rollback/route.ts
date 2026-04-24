import { requireAdminApi } from "@/lib/auth/rbac";
import { rollbackSystemPrompt } from "@/lib/chatbots/prompts";
import { z } from "zod";

const BodySchema = z.object({ toVersion: z.number().int().positive() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    const newVersion = await rollbackSystemPrompt({
      botId: id,
      toVersion: body.toVersion,
      actorId: guard.user.id,
    });
    return Response.json({ version: newVersion });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
