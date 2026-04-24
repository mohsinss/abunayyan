import type { ProposedColumn, ProposedView } from "../proposer";

export type DatasetRow = { data: Record<string, unknown> };

type Aggregation = "sum" | "avg" | "count" | "min" | "max" | "none";

export type ChartPoint = { x: string | number; y: number; series?: string };

// For every view kind, aggregate rows down to the shape the component wants.
// Kept framework-free so the same transforms power server preview + client
// rendering + future headless uses (exports, snapshots).

export function aggregateBarOrLine(
  rows: DatasetRow[],
  xCol: ProposedColumn,
  yCol: ProposedColumn,
  aggregation: Aggregation,
  opts: { groupBy?: ProposedColumn; topN?: number } = {},
): ChartPoint[] {
  const buckets = new Map<string, Map<string, number[]>>();
  const defaultSeries = "__default__";

  for (const r of rows) {
    const xRaw = r.data[xCol.source.column];
    if (xRaw === undefined || xRaw === null) continue;
    const x = coerceKey(xRaw);

    const y = toNumber(r.data[yCol.source.column]);
    if (y === null && aggregation !== "count") continue;

    const seriesKey = opts.groupBy
      ? coerceKey(r.data[opts.groupBy.source.column] ?? "∅")
      : defaultSeries;

    const seriesMap = buckets.get(x) ?? new Map<string, number[]>();
    const arr = seriesMap.get(seriesKey) ?? [];
    if (aggregation === "count") {
      arr.push(1);
    } else if (y !== null) {
      arr.push(y);
    }
    seriesMap.set(seriesKey, arr);
    buckets.set(x, seriesMap);
  }

  const out: ChartPoint[] = [];
  for (const [x, seriesMap] of buckets) {
    for (const [seriesKey, values] of seriesMap) {
      out.push({
        x,
        y: applyAggregation(values, aggregation),
        series: seriesKey === defaultSeries ? undefined : seriesKey,
      });
    }
  }

  if (opts.topN && out.length > opts.topN) {
    // Keep the topN by y desc, preserving series coverage is best-effort.
    return out.sort((a, b) => b.y - a.y).slice(0, opts.topN);
  }
  return out;
}

export function aggregateKpi(
  rows: DatasetRow[],
  col: ProposedColumn,
  aggregation: Aggregation,
): number {
  const values: number[] = [];
  for (const r of rows) {
    if (aggregation === "count") {
      values.push(1);
      continue;
    }
    const v = toNumber(r.data[col.source.column]);
    if (v !== null) values.push(v);
  }
  return applyAggregation(values, aggregation);
}

export function aggregatePie(
  rows: DatasetRow[],
  categoryCol: ProposedColumn,
  valueCol: ProposedColumn,
  aggregation: Aggregation,
): Array<{ name: string; value: number }> {
  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    const cat = r.data[categoryCol.source.column];
    if (cat === undefined || cat === null) continue;
    const key = coerceKey(cat);
    const v = toNumber(r.data[valueCol.source.column]);
    if (v === null && aggregation !== "count") continue;
    const arr = buckets.get(key) ?? [];
    arr.push(aggregation === "count" ? 1 : (v as number));
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([name, values]) => ({
    name,
    value: applyAggregation(values, aggregation),
  }));
}

export function projectTable(
  rows: DatasetRow[],
  columns: ProposedColumn[],
): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c.id] = r.data[c.source.column] ?? null;
    return out;
  });
}

function applyAggregation(values: number[], agg: Aggregation): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "count":
      return values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "none":
      // No aggregation — return the first value. Callers that want "raw
      // rows" should use projectTable instead.
      return values[0] ?? 0;
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceKey(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function findColumn(columns: ProposedColumn[], id: string): ProposedColumn | null {
  return columns.find((c) => c.id === id) ?? null;
}

// Validates a view's column references resolve against the dataset columns.
// Used at render time to fail cleanly if config drift happens (e.g. a
// column was renamed after the card was generated).
export function resolveViewColumns(
  view: ProposedView,
  columns: ProposedColumn[],
): { ok: true } | { ok: false; missing: string[] } {
  const needed: string[] = [];
  switch (view.kind) {
    case "kpi":
      needed.push(view.columnId);
      break;
    case "bar":
    case "line":
      needed.push(view.xColumnId, view.yColumnId);
      if (view.groupByColumnId) needed.push(view.groupByColumnId);
      break;
    case "pie":
      needed.push(view.categoryColumnId, view.valueColumnId);
      break;
    case "table":
      needed.push(...view.columnIds);
      break;
  }
  const missing = needed.filter((id) => !findColumn(columns, id));
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}
