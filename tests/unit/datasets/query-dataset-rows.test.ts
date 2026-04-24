import { beforeEach, describe, expect, it, vi } from "vitest";

const cols = [
  { id: "region", label: "Region", type: "string", source: { fileId: "f", column: "region" }, nullable: false },
  { id: "revenue", label: "Revenue", type: "number", source: { fileId: "f", column: "revenue" }, nullable: false },
  { id: "year", label: "Year", type: "integer", source: { fileId: "f", column: "year" }, nullable: false },
];

const rows = [
  { data: { region: "NA", year: 2024, revenue: 100 } },
  { data: { region: "NA", year: 2025, revenue: 120 } },
  { data: { region: "EU", year: 2024, revenue: 80 } },
];

vi.mock("@/lib/db/queries/datasets", () => ({
  getDatasetById: vi.fn(async () => ({
    id: "ds-1",
    config: { version: 1, columns: cols, views: [] },
  })),
  getRowsForDataset: vi.fn(async () => rows),
}));

import { queryDatasetRows } from "@/lib/chatbots/tools/query-dataset-rows";

type AnyTool = ReturnType<typeof queryDatasetRows.builder> & {
  execute: (_args: unknown) => Promise<unknown>;
};

function ctx(overrides: Partial<{ datasetId: string | null }> = {}) {
  return {
    userId: "u-1",
    role: "admin" as const,
    botId: "b-1",
    threadId: null,
    datasetId: overrides.datasetId === undefined ? "ds-1" : overrides.datasetId,
  };
}

describe("queryDatasetRows tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("errors without a dataset context", async () => {
    const t = queryDatasetRows.builder(ctx({ datasetId: null })) as AnyTool;
    const out = (await t.execute({ kind: "kpi", columnId: "revenue", aggregation: "sum" })) as {
      error?: string;
    };
    expect(out.error).toBe("NO_DATASET_CONTEXT");
  });

  it("kpi sum returns aggregated value", async () => {
    const t = queryDatasetRows.builder(ctx()) as AnyTool;
    const out = (await t.execute({ kind: "kpi", columnId: "revenue", aggregation: "sum" })) as {
      kind: string;
      value: number;
      rowCount: number;
    };
    expect(out.kind).toBe("kpi");
    expect(out.value).toBe(300);
    expect(out.rowCount).toBe(3);
  });

  it("groupBy returns one point per x", async () => {
    const t = queryDatasetRows.builder(ctx()) as AnyTool;
    const out = (await t.execute({
      kind: "groupBy",
      xColumnId: "region",
      yColumnId: "revenue",
      aggregation: "sum",
    })) as { kind: string; points: Array<{ x: string; y: number }> };
    expect(out.kind).toBe("groupBy");
    const map = new Map(out.points.map((p) => [p.x, p.y]));
    expect(map.get("NA")).toBe(220);
    expect(map.get("EU")).toBe(80);
  });

  it("groupBy reports UNKNOWN_COLUMN for missing y", async () => {
    const t = queryDatasetRows.builder(ctx()) as AnyTool;
    const out = (await t.execute({
      kind: "groupBy",
      xColumnId: "region",
      yColumnId: "nope",
      aggregation: "sum",
    })) as { error?: string; missing?: string[] };
    expect(out.error).toBe("UNKNOWN_COLUMN");
    expect(out.missing).toEqual(["nope"]);
  });

  it("table projects only the selected columns and caps rows", async () => {
    const t = queryDatasetRows.builder(ctx()) as AnyTool;
    const out = (await t.execute({
      kind: "table",
      columnIds: ["region", "year"],
      limit: 2,
    })) as {
      kind: string;
      rows: Array<Record<string, unknown>>;
      truncated: boolean;
      totalRows: number;
      columns: Array<{ id: string }>;
    };
    expect(out.kind).toBe("table");
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toEqual({ region: "NA", year: 2024 });
    // 'revenue' must NOT leak into rows when not requested.
    expect(out.rows[0]).not.toHaveProperty("revenue");
    expect(out.truncated).toBe(true);
    expect(out.totalRows).toBe(3);
    expect(out.columns.map((c) => c.id)).toEqual(["region", "year"]);
  });

  it("pie returns slices keyed by category", async () => {
    const t = queryDatasetRows.builder(ctx()) as AnyTool;
    const out = (await t.execute({
      kind: "pie",
      categoryColumnId: "region",
      valueColumnId: "revenue",
      aggregation: "sum",
    })) as { kind: string; slices: Array<{ name: string; value: number }> };
    expect(out.kind).toBe("pie");
    const map = new Map(out.slices.map((s) => [s.name, s.value]));
    expect(map.get("NA")).toBe(220);
    expect(map.get("EU")).toBe(80);
  });
});
