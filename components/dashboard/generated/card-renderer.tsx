import type { ProposedColumn, ProposedView } from "@/lib/datasets/proposer";
import {
  aggregateBarOrLine,
  aggregateKpi,
  aggregatePie,
  findColumn,
  projectTable,
  resolveViewColumns,
  type DatasetRow,
} from "@/lib/datasets/renderer/aggregate";
import { SectionShell, Card } from "@/components/dashboard/section-shell";
import { BarView } from "./bar-view";
import { formatKpiValue } from "./kpi-view";
import { LineView } from "./line-view";
import { PieView } from "./pie-view";
import { TableView } from "./table-view";
import { ViewBoundary } from "./view-boundary";
import { GeneratedKpiStrip, type KpiTile } from "./kpi-strip";

// Server component: validated config + raw rows go in, an editorially-styled
// tree of sections + charts comes out. KPI views collapse into a single
// strip up top (matches the SBU rhythm); every other view becomes its own
// numbered SectionShell so the sidebar nav has anchors to scroll to.
export function CardRenderer({
  columns,
  views,
  rows,
}: {
  columns: ProposedColumn[];
  views: ProposedView[];
  rows: DatasetRow[];
}) {
  const kpis = views.filter((v) => v.kind === "kpi");
  const others = views.filter((v) => v.kind !== "kpi");

  const kpiTiles: KpiTile[] = [];
  for (const v of kpis) {
    if (v.kind !== "kpi") continue;
    const col = findColumn(columns, v.columnId);
    if (!col) continue;
    const value = aggregateKpi(rows, col, v.aggregation);
    kpiTiles.push({
      id: v.id,
      label: v.title,
      value: formatKpiValue(value, v.format),
      sub: col.label,
    });
  }

  return (
    <div className="space-y-2">
      {kpiTiles.length > 0 ? <GeneratedKpiStrip tiles={kpiTiles} /> : null}

      {others.map((v, i) => {
        const num = String(i + 1).padStart(2, "0");
        return (
          <SectionShell
            key={v.id}
            id={`view-${v.id}`}
            num={num}
            title={v.title}
            description={kindLabel(v.kind)}
          >
            <Card>
              <ViewBoundary title={v.title}>
                <RenderOne view={v} columns={columns} rows={rows} />
              </ViewBoundary>
            </Card>
          </SectionShell>
        );
      })}
    </div>
  );
}

function kindLabel(kind: ProposedView["kind"]): string {
  switch (kind) {
    case "bar":
      return "Bar chart";
    case "line":
      return "Line chart";
    case "pie":
      return "Composition";
    case "table":
      return "Tabular";
    case "kpi":
      return "KPI";
  }
}

function RenderOne({
  view,
  columns,
  rows,
}: {
  view: ProposedView;
  columns: ProposedColumn[];
  rows: DatasetRow[];
}) {
  const check = resolveViewColumns(view, columns);
  if (!check.ok) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-alert">
        Missing columns: {check.missing.join(", ")}
      </p>
    );
  }

  switch (view.kind) {
    case "kpi":
      // KPI views are surfaced through GeneratedKpiStrip; this branch only
      // hits if a KPI view somehow lands outside the strip path (it shouldn't).
      return null;
    case "bar":
    case "line": {
      const xCol = findColumn(columns, view.xColumnId);
      const yCol = findColumn(columns, view.yColumnId);
      const groupBy = view.groupByColumnId ? findColumn(columns, view.groupByColumnId) : undefined;
      if (!xCol || !yCol) return null;
      const data = aggregateBarOrLine(rows, xCol, yCol, view.aggregation, {
        groupBy: groupBy ?? undefined,
        topN: view.topN,
      });
      const Comp = view.kind === "bar" ? BarView : LineView;
      return <Comp title={view.title} data={data} xLabel={xCol.label} yLabel={yCol.label} />;
    }
    case "pie": {
      const catCol = findColumn(columns, view.categoryColumnId);
      const valCol = findColumn(columns, view.valueColumnId);
      if (!catCol || !valCol) return null;
      const data = aggregatePie(rows, catCol, valCol, view.aggregation);
      return <PieView title={view.title} data={data} />;
    }
    case "table": {
      const tableCols = view.columnIds
        .map((id) => findColumn(columns, id))
        .filter(Boolean) as ProposedColumn[];
      const tableRows = projectTable(rows, tableCols);
      return (
        <TableView
          title={view.title}
          columns={tableCols}
          rows={tableRows}
          pageSize={view.pageSize}
        />
      );
    }
  }
}
