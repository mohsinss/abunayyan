import { describe, expect, it } from "vitest";
import {
  aggregateBarOrLine,
  aggregateKpi,
  aggregatePie,
  projectTable,
  resolveViewColumns,
  findColumn,
} from "@/lib/datasets/renderer/aggregate";
import type { ProposedColumn } from "@/lib/datasets/proposer";

const cols: ProposedColumn[] = [
  { id: "region", label: "Region", type: "string", source: { fileId: "f", column: "region" }, nullable: false },
  { id: "revenue", label: "Revenue", type: "number", source: { fileId: "f", column: "revenue" }, nullable: false },
  { id: "year", label: "Year", type: "integer", source: { fileId: "f", column: "year" }, nullable: false },
];

const rows = [
  { data: { region: "NA", year: 2024, revenue: 100 } },
  { data: { region: "NA", year: 2025, revenue: 120 } },
  { data: { region: "EU", year: 2024, revenue: 80 } },
  { data: { region: "EU", year: 2025, revenue: 95 } },
  { data: { region: "APAC", year: 2024, revenue: 50 } },
];

describe("aggregateKpi", () => {
  it("sums a numeric column", () => {
    expect(aggregateKpi(rows, cols[1]!, "sum")).toBe(445);
  });
  it("averages a numeric column", () => {
    expect(aggregateKpi(rows, cols[1]!, "avg")).toBe(89);
  });
  it("counts regardless of value", () => {
    expect(aggregateKpi(rows, cols[1]!, "count")).toBe(5);
  });
  it("min / max across values", () => {
    expect(aggregateKpi(rows, cols[1]!, "min")).toBe(50);
    expect(aggregateKpi(rows, cols[1]!, "max")).toBe(120);
  });
  it("returns 0 when no numeric values present", () => {
    const stringOnly: ProposedColumn = { id: "region", label: "Region", type: "string", source: { fileId: "f", column: "region" }, nullable: false };
    expect(aggregateKpi(rows, stringOnly, "sum")).toBe(0);
  });
});

describe("aggregateBarOrLine", () => {
  it("sums y by x when no groupBy", () => {
    const points = aggregateBarOrLine(rows, cols[0]!, cols[1]!, "sum");
    const map = new Map(points.map((p) => [p.x, p.y]));
    expect(map.get("NA")).toBe(220);
    expect(map.get("EU")).toBe(175);
    expect(map.get("APAC")).toBe(50);
    expect(points.every((p) => p.series === undefined)).toBe(true);
  });

  it("produces one point per (x, groupBy) pair", () => {
    const points = aggregateBarOrLine(rows, cols[0]!, cols[1]!, "sum", { groupBy: cols[2] });
    // Two years per region except APAC (only 2024), so 2+2+1 = 5
    expect(points.length).toBe(5);
    const naY2024 = points.find((p) => p.x === "NA" && p.series === "2024");
    expect(naY2024?.y).toBe(100);
  });

  it("applies topN limit on descending y", () => {
    const points = aggregateBarOrLine(rows, cols[0]!, cols[1]!, "sum", { topN: 2 });
    expect(points.length).toBe(2);
    expect(points[0]!.y).toBeGreaterThanOrEqual(points[1]!.y);
  });
});

describe("aggregatePie", () => {
  it("sums values by category and lists each category once", () => {
    const slices = aggregatePie(rows, cols[0]!, cols[1]!, "sum");
    const map = new Map(slices.map((s) => [s.name, s.value]));
    expect(slices.length).toBe(3);
    expect(map.get("NA")).toBe(220);
  });
});

describe("projectTable", () => {
  it("returns one record per row keyed by column id", () => {
    const out = projectTable(rows, [cols[0]!, cols[2]!]);
    expect(out[0]).toEqual({ region: "NA", year: 2024 });
    expect(out.length).toBe(rows.length);
  });
});

describe("resolveViewColumns", () => {
  it("reports missing columns for bar view", () => {
    const res = resolveViewColumns(
      {
        kind: "bar",
        id: "v",
        title: "t",
        xColumnId: "region",
        yColumnId: "nonexistent",
        aggregation: "sum",
      },
      cols,
    );
    expect(res).toEqual({ ok: false, missing: ["nonexistent"] });
  });

  it("reports ok when all columns resolve", () => {
    const res = resolveViewColumns(
      {
        kind: "pie",
        id: "v",
        title: "t",
        categoryColumnId: "region",
        valueColumnId: "revenue",
        aggregation: "sum",
      },
      cols,
    );
    expect(res).toEqual({ ok: true });
  });
});

describe("findColumn", () => {
  it("returns the column by id", () => {
    expect(findColumn(cols, "revenue")?.label).toBe("Revenue");
  });
  it("returns null for unknown id", () => {
    expect(findColumn(cols, "missing")).toBe(null);
  });
});
