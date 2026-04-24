type KpiFormat = "number" | "currency" | "percent";

function formatValue(v: number, fmt: KpiFormat | undefined): string {
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
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">
        {formatValue(value, format)}
      </div>
    </section>
  );
}
