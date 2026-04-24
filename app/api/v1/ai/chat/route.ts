// DEPRECATED: use POST /api/v1/chatbots/general/chat.
// This proxy exists so bookmarked URLs and in-flight client builds keep
// working for one release. Delete in the release after all clients have
// migrated to the canonical platform route.

import { handleChatRequest } from "@/lib/chatbots/route-handler";

export const runtime = "nodejs";
export const maxDuration = 60;

const LEGACY_SLUG = "general";

export async function POST(req: Request) {
  return handleChatRequest(req, LEGACY_SLUG);
}
