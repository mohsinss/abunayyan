import { handleChatRequest } from "@/lib/chatbots/route-handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return handleChatRequest(req, slug);
}
