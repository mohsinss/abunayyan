import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { embedText } from "@/lib/ai/embed";
import { searchDocumentsByEmbedding } from "@/lib/db/queries/documents";
import type { ToolDefinition } from "./types";

const description = "Search the user's uploaded documents by semantic similarity.";

export const searchDocs: ToolDefinition = {
  id: "searchDocs",
  description,
  costClass: "cheap",
  builder: (ctx) =>
    tool({
      description,
      parameters: z.object({
        query: z.string().min(3).max(500),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, limit }) => {
        const embedding = await embedText(query);
        const rows = await searchDocumentsByEmbedding(ctx.userId, embedding, limit);
        return {
          results: rows.map((r) => ({ id: r.id, content: r.content, score: 1 - r.distance })),
        };
      },
    }),
};
