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
import { BarView } from "./bar-view";
import { KpiView } from "./kpi-view";
import { LineView } from "./line-view";
import { PieView } from "./pie-view";
import { TableView } from "./table-view";

// Server component: receives the validated config + raw dataset_rows, runs
// aggregation on the server (no row data leaks to the client), and emits a
// tree of presentation components per view. View components are client
// components for Recharts interactivity; they receive already-shaped data.
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

  return (
    <div className="space-y-6">
      {kpis.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((v) => (
            <RenderOne key={v.id} view={v} columns={columns} rows={rows} />
          ))}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {others.map((v) => (
          <RenderOne key={v.id} view={v} columns={columns} rows={rows} />
        ))}
      </div>
    </div>
  );
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
      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="text-base font-semibold">{view.title}</h3>
        <p className="mt-2 text-sm text-destructive">
          View references columns that are no longer in the dataset: {check.missing.join(", ")}.
        </p>
      </section>
    );
  }

  switch (view.kind) {
    case "kpi": {
      const col = findColumn(columns, view.columnId);
      if (!col) return null;
      const value = aggregateKpi(rows, col, view.aggregation);
      return <KpiView title={view.title} value={value} format={view.format} />;
    }
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
      const tableCols = view.columnIds.map((id) => findColumn(columns, id)).filter(Boolean) as ProposedColumn[];
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
