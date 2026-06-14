"use client";

import { strategyClusters } from "@/lib/dashboard/data";
import { entityById } from "@/lib/dashboard/derived";
import { Card, SectionShell } from "@/components/dashboard/section-shell";
import { EntityChip } from "@/components/dashboard/entity-chip";

const clusterTone: Record<
  (typeof strategyClusters)[number]["id"],
  { stripe: string; chipBg: string; chipFg: string; accent: string }
> = {
  rescue: {
    stripe: "linear-gradient(90deg, var(--atlas-alert), #c44536)",
    chipBg: "var(--atlas-alert-soft)",
    chipFg: "var(--atlas-alert)",
    accent: "var(--atlas-alert)",
  },
  scale: {
    stripe: "linear-gradient(90deg, var(--atlas-accent), var(--atlas-accent-2))",
    chipBg: "var(--atlas-accent-soft)",
    chipFg: "var(--atlas-accent)",
    accent: "var(--atlas-accent)",
  },
  watch: {
    stripe: "linear-gradient(90deg, var(--atlas-warn), #d48543)",
    chipBg: "var(--atlas-warn-soft)",
    chipFg: "var(--atlas-warn)",
    accent: "var(--atlas-warn)",
  },
};

export function StrategicReadoutSection() {
  return (
    <SectionShell
      id="strategy"
      num="07"
      title={
        <>
          Strategic <em className="italic text-atlas-gold">Readout</em>
        </>
      }
      description="What this atlas tells you"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {strategyClusters.map((c) => {
          const tone = clusterTone[c.id];
          return (
            <Card key={c.id} className="relative overflow-hidden !p-0">
              <div
                className="absolute left-0 right-0 top-0 h-1"
                style={{ background: tone.stripe }}
              />
              <div className="p-6 pt-7">
                <div className="font-mono text-[10px] uppercase tracking-[2px] text-atlas-ink-3">
                  {c.label}
                </div>
                <h3 className="mt-3 font-serif text-[26px] font-medium leading-tight tracking-tight text-atlas-ink">
                  {c.title.split(" ").slice(0, -1).join(" ")}{" "}
                  <em className="italic" style={{ color: tone.accent }}>
                    {c.title.split(" ").slice(-1)[0]}
                  </em>
                </h3>
                <p className="mt-1 font-serif text-[14px] italic text-atlas-ink-3">
                  {c.subtitle}
                </p>

                <div
                  className="mt-4 flex flex-wrap items-center gap-1.5 rounded-sm px-3 py-2.5 font-sans text-[13px] font-semibold"
                  style={{ backgroundColor: tone.chipBg, color: tone.chipFg }}
                >
                  {c.entityIds.map((id, i) => {
                    const e = entityById(id);
                    return (
                      <span key={id} className="flex items-center gap-1.5">
                        <EntityChip id={e.id} name={e.name} isJV={e.isJV} className="text-[13px]" />
                        {i < c.entityIds.length - 1 && <span className="opacity-60">·</span>}
                      </span>
                    );
                  })}
                </div>

                <dl className="mt-4 space-y-2">
                  {c.stats.map((s) => (
                    <div
                      key={s.label}
                      className="flex justify-between border-b border-dashed border-atlas-line pb-1.5 font-mono text-[11px]"
                    >
                      <dt className="text-[10px] uppercase tracking-[1px] text-atlas-ink-3">
                        {s.label}
                      </dt>
                      <dd className="font-semibold text-atlas-ink">{s.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 border-t border-atlas-line pt-3">
                  <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[1.5px] text-atlas-ink">
                    Mandate
                  </div>
                  <p className="font-serif text-[14px] italic leading-relaxed text-atlas-ink-2">
                    {c.mandate}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <footer className="mt-14 flex flex-wrap items-start justify-between gap-4 border-t border-atlas-line pt-6 font-mono text-[10px] text-atlas-ink-3">
        <div>
          <div>AHC AI Transformation Office · Dashboard v1.1</div>
          <div className="mt-1">
            Sources: Departments Cost Allocation v2 (30-Mar-2026) · costs_analysis.xlsx
          </div>
        </div>
        <div className="max-w-md font-serif text-[13px] italic text-atlas-ink-2">
          Next: overlay working-capital data from Shahbaz · initiate SLA pricing-model redesign with
          Tasnim &amp; CFO
        </div>
      </footer>
    </SectionShell>
  );
}
