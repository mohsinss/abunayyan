import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { embedText } from "@/lib/ai/embed";
import { searchDocumentsByDatasetEmbedding } from "@/lib/db/queries/documents";
import type { ToolDefinition } from "./types";

const description =
  "Search this dataset card's indexed documents by semantic similarity. " +
  "Returns top-k chunks scoped to the card, never other cards' data.";

// Strips internal-metadata prefixes (e.g. "[wc-chunk:slot:hash]\n") that
// some retrain pipelines stamp at the head of stored content for diff
// tracking. The model should never see these — they look like prompt
// injection markers and burn tool-call cycles trying to "use" them.
const SENTINEL_LINE = /^\[[\w.-]+(?::[\w.-]+)+\]\n/;
function stripSentinel(content: string): string {
  return content.replace(SENTINEL_LINE, "");
}

export const searchDatasetDocs: ToolDefinition = {
  id: "searchDatasetDocs",
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
        if (!ctx.datasetId) {
          return {
            error: "NO_DATASET_CONTEXT",
            message:
              "This tool only works inside a dataset card's chatbot. The runtime did not supply a datasetId.",
          };
        }
        const embedding = await embedText(query);
        const rows = await searchDocumentsByDatasetEmbedding(ctx.datasetId, embedding, limit);
        return {
          results: rows.map((r) => ({
            id: r.id,
            content: stripSentinel(r.content),
            score: 1 - r.distance,
          })),
        };
      },
    }),
};
