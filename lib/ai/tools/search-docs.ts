import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { embedText } from "@/lib/ai/embed";
import { searchDocumentsByEmbedding } from "@/lib/db/queries/documents";

export function makeSearchDocsTool(userId: string) {
  return tool({
    description: "Search the user's uploaded documents by semantic similarity.",
    parameters: z.object({
      query: z.string().describe("The natural-language search query."),
      limit: z.number().int().min(1).max(20).default(5),
    }),
    execute: async ({ query, limit }) => {
      const embedding = await embedText(query);
      const rows = await searchDocumentsByEmbedding(userId, embedding, limit);
      return rows.map((r) => ({
        id: r.id,
        content: r.content,
        score: 1 - r.distance,
      }));
    },
  });
}
