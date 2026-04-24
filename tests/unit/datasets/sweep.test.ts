import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/datasets/blob", () => ({
  deleteBlob: vi.fn(async () => {}),
  isBlobConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/db/queries/datasets", () => ({
  listStaleDeletedDatasets: vi.fn(),
  listFilesForDataset: vi.fn(),
  hardDeleteDataset: vi.fn(async () => {}),
  hardDeleteChatbotIfSoftDeleted: vi.fn(async () => true),
}));

import { deleteBlob, isBlobConfigured } from "@/lib/datasets/blob";
import {
  hardDeleteChatbotIfSoftDeleted,
  hardDeleteDataset,
  listFilesForDataset,
  listStaleDeletedDatasets,
} from "@/lib/db/queries/datasets";
import { runDatasetSweep } from "@/lib/datasets/sweep";

const deleteBlobMock = deleteBlob as unknown as ReturnType<typeof vi.fn>;
const isBlobConfiguredMock = isBlobConfigured as unknown as ReturnType<typeof vi.fn>;
const listStaleMock = listStaleDeletedDatasets as unknown as ReturnType<typeof vi.fn>;
const listFilesMock = listFilesForDataset as unknown as ReturnType<typeof vi.fn>;
const hardDeleteDatasetMock = hardDeleteDataset as unknown as ReturnType<typeof vi.fn>;
const hardDeleteBotMock = hardDeleteChatbotIfSoftDeleted as unknown as ReturnType<typeof vi.fn>;

function ds(overrides: Partial<{ id: string; chatbotId: string | null }> = {}) {
  return {
    id: overrides.id ?? "ds-1",
    chatbotId: overrides.chatbotId === undefined ? "bot-1" : overrides.chatbotId,
  };
}

describe("runDatasetSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBlobConfiguredMock.mockReturnValue(true);
    deleteBlobMock.mockResolvedValue(undefined);
    hardDeleteDatasetMock.mockResolvedValue(undefined);
    hardDeleteBotMock.mockResolvedValue(true);
  });

  it("noops when nothing is past retention", async () => {
    listStaleMock.mockResolvedValue([]);
    const r = await runDatasetSweep();
    expect(r).toEqual({
      datasetsHardDeleted: 0,
      blobsDeleted: 0,
      blobErrors: 0,
      chatbotsHardDeleted: 0,
    });
    expect(hardDeleteDatasetMock).not.toHaveBeenCalled();
    expect(deleteBlobMock).not.toHaveBeenCalled();
  });

  it("deletes blobs BEFORE the dataset row (avoids orphaning)", async () => {
    const order: string[] = [];
    listStaleMock.mockResolvedValue([ds()]);
    listFilesMock.mockResolvedValue([
      { id: "f-1", storageKey: "https://blob/one" },
      { id: "f-2", storageKey: "https://blob/two" },
    ]);
    deleteBlobMock.mockImplementation(async (key: string) => {
      order.push(`blob:${key}`);
    });
    hardDeleteDatasetMock.mockImplementation(async (id: string) => {
      order.push(`ds:${id}`);
    });

    const r = await runDatasetSweep();
    expect(r.blobsDeleted).toBe(2);
    expect(r.datasetsHardDeleted).toBe(1);
    expect(r.chatbotsHardDeleted).toBe(1);
    // Both blobs land before the row delete.
    expect(order).toEqual(["blob:https://blob/one", "blob:https://blob/two", "ds:ds-1"]);
  });

  it("continues past blob failures, counting them as errors", async () => {
    listStaleMock.mockResolvedValue([ds()]);
    listFilesMock.mockResolvedValue([
      { id: "f-1", storageKey: "https://blob/one" },
      { id: "f-2", storageKey: "https://blob/two" },
    ]);
    deleteBlobMock
      .mockRejectedValueOnce(new Error("409 blob gone"))
      .mockResolvedValueOnce(undefined);

    const r = await runDatasetSweep();
    expect(r.blobsDeleted).toBe(1);
    expect(r.blobErrors).toBe(1);
    // Dataset still hard-deletes even when a blob call fails.
    expect(r.datasetsHardDeleted).toBe(1);
  });

  it("skips blob deletion entirely when Vercel Blob is not configured", async () => {
    isBlobConfiguredMock.mockReturnValue(false);
    listStaleMock.mockResolvedValue([ds()]);
    listFilesMock.mockResolvedValue([{ id: "f-1", storageKey: "https://blob/one" }]);

    const r = await runDatasetSweep();
    expect(r.blobsDeleted).toBe(0);
    expect(r.blobErrors).toBe(0);
    expect(deleteBlobMock).not.toHaveBeenCalled();
    // Row still hard-deletes (so the DB doesn't grow forever).
    expect(r.datasetsHardDeleted).toBe(1);
  });

  it("does not hard-delete a chatbot that was never linked", async () => {
    listStaleMock.mockResolvedValue([ds({ chatbotId: null })]);
    listFilesMock.mockResolvedValue([]);

    const r = await runDatasetSweep();
    expect(r.chatbotsHardDeleted).toBe(0);
    expect(hardDeleteBotMock).not.toHaveBeenCalled();
  });

  it("accepts a custom retentionDays and computes a correct cutoff", async () => {
    listStaleMock.mockResolvedValue([]);
    await runDatasetSweep({ retentionDays: 7 });
    const cutoff = listStaleMock.mock.calls[0]?.[0] as Date;
    const expected = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Allow 1-second slop for test runtime.
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(1000);
  });
});
