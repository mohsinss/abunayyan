"use client";

import { useMemo, useState } from "react";
import { departments } from "@/lib/dashboard/data";
import { deptClassMeta } from "@/lib/dashboard/tokens";
import { formatSAR } from "@/lib/dashboard/derived";
import type { DeptClassification } from "@/lib/dashboard/types";
import { Card, SectionShell } from "@/components/dashboard/section-shell";
import { FilterChips, Segmented, Toolbar } from "@/components/dashboard/chart-controls";
import { scrollToSection } from "@/components/dashboard/selected-entity-provider";

type SortMode = "budget" | "absorbed" | "recovery";

const classOrder: DeptClassification[] = [
  "tier1",
  "tier2",
  "tier3",
  "quickwin",
  "ceo-named",
  "wc-lever",
];

export function DepartmentsSection() {
  const [enabled, setEnabled] = useState<DeptClassification[]>([...classOrder]);
  const [sort, setSort] = useState<SortMode>("budget");

  const filtered = useMemo(() => {
    const list = departments.filter((d) => enabled.includes(d.classification));
    const fns: Record<SortMode, (a: typeof list[0], b: typeof list[0]) => number> = {
      budget: (a, b) => b.budget - a.budget,
      absorbed: (a, b) => b.absorbed - a.absorbed,
      recovery: (a, b) => b.recoveredPct - a.recoveredPct,
    };
    return [...list].sort(fns[sort]);
  }, [enabled, sort]);

  const toggle = (c: DeptClassification) => {
    setEnabled((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  return (
    <SectionShell
      id="departments"
      num="06"
      title={
        <>
          HQ Department <em className="italic text-atlas-gold">Budgets</em>
        </>
      }
      description="AI-addressable overhead · 142.5M · 15 functions"
    >
      <Card
        title="Central function spend"
        subtitle="Click a card to jump to its SLA allocation row in the matrix above"
      >
        <Toolbar>
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "budget", label: "Budget" },
              { value: "absorbed", label: "Absorbed" },
              { value: "recovery", label: "Recovery" },
            ]}
          />
          <FilterChips
            label="Class"
            values={enabled}
            onToggle={toggle}
            options={classOrder.map((c) => ({
              value: c,
              label: deptClassMeta[c].label,
              dot: deptClassMeta[c].color,
            }))}
          />
        </Toolbar>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((d) => {
            const meta = deptClassMeta[d.classification];
            return (
              <button
                type="button"
                key={d.id}
                onClick={() => scrollToSection("matrix")}
                className="group relative rounded-sm border border-atlas-line bg-atlas-bg-2 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-atlas-gold"
                style={{ borderTop: `3px solid ${meta.color}` }}
              >
                <span
                  className="absolute right-3 top-3 rounded-sm px-1.5 py-[2px] font-mono text-[8px] font-semibold uppercase tracking-[1.2px]"
                  style={{ backgroundColor: meta.soft, color: meta.color }}
                >
                  {meta.label}
                </span>
                <div className="font-serif text-[15px] font-semibold tracking-tight text-atlas-ink">
                  {d.name}
                </div>
                <div className="mt-2 font-serif text-[28px] font-medium leading-none tracking-tight text-atlas-gold">
                  {formatSAR(d.budget)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-atlas-line pt-3 font-mono text-[11px] text-atlas-ink-2">
                  <div>
                    <div className="mb-0.5 font-medium uppercase tracking-[1.2px] text-[9px] text-atlas-ink-3">
                      Recovered
                    </div>
                    {(d.recoveredPct * 100).toFixed(1)}%
                  </div>
                  <div>
                    <div className="mb-0.5 font-medium uppercase tracking-[1.2px] text-[9px] text-atlas-ink-3">
                      Absorbed
                    </div>
                    {d.absorbed < 0 ? `(${formatSAR(Math.abs(d.absorbed))})` : formatSAR(d.absorbed)}
                  </div>
                  <div>
                    <div className="mb-0.5 font-medium uppercase tracking-[1.2px] text-[9px] text-atlas-ink-3">
                      Share of 142M
                    </div>
                    {(d.shareOfOverhead * 100).toFixed(1)}%
                  </div>
                  <div>
                    <div className="mb-0.5 font-medium uppercase tracking-[1.2px] text-[9px] text-atlas-ink-3">
                      Cost driver
                    </div>
                    <span className="text-atlas-ink">{d.costDriver}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center font-mono text-[11px] uppercase tracking-[1.5px] text-atlas-ink-3">
            No departments match current filters
          </div>
        )}
      </Card>
    </SectionShell>
  );
}
