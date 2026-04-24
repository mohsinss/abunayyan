// Standalone KPI tile — only used when a generated card has KPI views that
// don't fit into the top strip (rare). The renderer prefers GeneratedKpiStrip
// for top-line numbers because the strip is the established visual rhythm.

type KpiFormat = "number" | "currency" | "percent";

export function formatKpiValue(v: number, fmt: KpiFormat | undefined): string {
  if (!Number.isFinite(v)) return "—";
  switch (fmt) {
    case "currency":
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
    case "percent":
      return new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(v);
    default:
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
      }).format(v);
  }
}

export function KpiView({
  title,
  value,
  format,
}: {
  title: string;
  value: number;
  format?: KpiFormat;
}) {
  return (
    <div className="rounded-sm border border-atlas-line bg-atlas-bg-2 p-5">
      <div className="font-mono text-[9px] font-medium uppercase tracking-[1.8px] text-atlas-ink-3">
        {title}
      </div>
      <div className="mt-3 font-serif text-[38px] font-medium leading-none tracking-tight text-atlas-ink">
        {formatKpiValue(value, format)}
      </div>
    </div>
  );
}
