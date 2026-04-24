// Editorial KPI strip — visual twin of components/dashboard/kpi-strip but
// driven by props instead of the SBU-only kpis const. Drop into the top of
// a generated card when ≥1 kpi view exists in CardConfig.

export type KpiTile = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  emphasis?: "default" | "warn" | "alert";
};

export function GeneratedKpiStrip({ tiles }: { tiles: KpiTile[] }) {
  if (tiles.length === 0) return null;
  // Mirror SBU's grid math: 2-up on small, 3-up on md, 6-up on lg. Cap at 6
  // since that's where the type rhythm collapses; extra KPIs just wrap.
  return (
    <div className="mt-8 grid grid-cols-2 rounded-sm border border-atlas-line bg-atlas-bg-2 shadow-[0_1px_0_rgba(0,0,0,0.02)] md:grid-cols-3 lg:grid-cols-6">
      {tiles.map((k, i) => {
        const valueColor =
          k.emphasis === "alert"
            ? "text-atlas-alert"
            : k.emphasis === "warn"
              ? "text-atlas-warn"
              : "text-atlas-ink";
        return (
          <div
            key={k.id}
            className={`px-6 py-5 ${
              i < tiles.length - 1 ? "md:border-r md:border-atlas-line" : ""
            } ${i % 2 === 0 ? "border-r border-atlas-line" : ""} ${
              i < tiles.length - 2 ? "border-b border-atlas-line md:border-b-0" : ""
            }`}
          >
            <div className="font-mono text-[9px] font-medium uppercase tracking-[1.8px] text-atlas-ink-3">
              {k.label}
            </div>
            <div
              className={`mt-3 font-serif text-[38px] font-medium leading-none tracking-tight ${valueColor}`}
            >
              {k.value}
            </div>
            {k.sub ? (
              <div className="mt-2.5 font-mono text-[10px] tracking-[0.3px] text-atlas-ink-3">
                {k.sub}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
