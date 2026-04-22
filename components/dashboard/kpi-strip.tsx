import { kpis } from "@/lib/dashboard/data";

export function KpiStrip() {
  return (
    <div className="mt-8 grid grid-cols-2 rounded-sm border border-atlas-line bg-atlas-bg-2 shadow-[0_1px_0_rgba(0,0,0,0.02)] md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k, i) => {
        const valueColor =
          k.emphasis === "alert"
            ? "text-atlas-alert"
            : k.emphasis === "warn"
              ? "text-atlas-warn"
              : "text-atlas-ink";
        return (
          <div
            key={k.label}
            className={`px-6 py-5 ${
              i < kpis.length - 1 ? "md:border-r md:border-atlas-line" : ""
            } ${i % 2 === 0 ? "border-r border-atlas-line" : ""} ${
              i < kpis.length - 2 ? "border-b border-atlas-line md:border-b-0" : ""
            }`}
          >
            <div className="font-mono text-[9px] font-medium uppercase tracking-[1.8px] text-atlas-ink-3">
              {k.label}
            </div>
            <div
              className={`mt-3 font-serif text-[38px] font-medium leading-none tracking-tight ${valueColor}`}
            >
              {k.value}
              {k.unit && (
                <small className="ml-1 font-sans text-[13px] font-medium text-atlas-ink-3">
                  {k.unit}
                </small>
              )}
            </div>
            <div className="mt-2.5 font-mono text-[10px] tracking-[0.3px] text-atlas-ink-3">
              {k.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
