import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock embedText and the scoped query before importing the tool.
vi.mock("@/lib/ai/embed", () => ({
  embedText: vi.fn(async () => Array(1536).fill(0.01)),
  embedTextMany: vi.fn(async (texts: string[]) => texts.map(() => Array(1536).fill(0.01))),
}));

vi.mock("@/lib/db/queries/documents", () => ({
  searchDocumentsByDatasetEmbedding: vi.fn(async () => [
    { id: "doc-1", content: "scoped result", distance: 0.2 },
  ]),
  searchDocumentsByEmbedding: vi.fn(),
}));

import { embedText } from "@/lib/ai/embed";
import {
  searchDocumentsByDatasetEmbedding,
  searchDocumentsByEmbedding,
} from "@/lib/db/queries/documents";
import { searchDatasetDocs } from "@/lib/chatbots/tools/search-dataset-docs";

type AnyTool = ReturnType<typeof searchDatasetDocs.builder> & {
  execute: (_args: { query: string; limit?: number }, _opts?: unknown) => Promise<unknown>;
};

function baseCtx(overrides: Partial<{ datasetId: string | null }> = {}) {
  return {
    userId: "user-1",
    role: "admin" as const,
    botId: "bot-1",
    threadId: null,
    datasetId: overrides.datasetId === undefined ? "ds-1" : overrides.datasetId,
  };
}

describe("searchDatasetDocs tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns NO_DATASET_CONTEXT error when ctx.datasetId is null", async () => {
    const t = searchDatasetDocs.builder(baseCtx({ datasetId: null })) as AnyTool;
    const result = (await t.execute({ query: "hello world" })) as {
      error?: string;
    };
    expect(result.error).toBe("NO_DATASET_CONTEXT");
    expect(searchDocumentsByDatasetEmbedding).not.toHaveBeenCalled();
  });

  it("calls dataset-scoped search with the correct datasetId", async () => {
    const t = searchDatasetDocs.builder(baseCtx()) as AnyTool;
    const result = (await t.execute({ query: "hello world", limit: 3 })) as {
      results?: Array<{ id: string; score: number }>;
    };

    expect(embedText).toHaveBeenCalledWith("hello world");
    expect(searchDocumentsByDatasetEmbedding).toHaveBeenCalledWith(
      "ds-1",
      expect.any(Array),
      3,
    );
    // Crucially, never falls through to the user-scoped variant.
    expect(searchDocumentsByEmbedding).not.toHaveBeenCalled();
    expect(result.results?.[0]?.id).toBe("doc-1");
    expect(result.results?.[0]?.score).toBeCloseTo(0.8);
  });

  it("passes the requested limit straight through to the scoped query", async () => {
    const t = searchDatasetDocs.builder(baseCtx()) as AnyTool;
    await t.execute({ query: "anything", limit: 2 });
    expect(searchDocumentsByDatasetEmbedding).toHaveBeenCalledWith(
      "ds-1",
      expect.any(Array),
      2,
    );
  });
});
