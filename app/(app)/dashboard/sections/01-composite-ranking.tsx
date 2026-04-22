"use client";

import { useMemo, useState } from "react";
import { entities } from "@/lib/dashboard/data";
import { severityGradient, scoreToSeverity, tierOrder, tierMeta } from "@/lib/dashboard/tokens";
import { formatSAR } from "@/lib/dashboard/derived";
import type { Tier } from "@/lib/dashboard/types";
import { Card, FilterNote, SectionShell } from "@/components/dashboard/section-shell";
import { EntityChip } from "@/components/dashboard/entity-chip";
import { TierBadge } from "@/components/dashboard/tier-badge";
import { FilterChips, Segmented, Toolbar } from "@/components/dashboard/chart-controls";
import { useSelectedEntity } from "@/components/dashboard/selected-entity-provider";

type SortKey = "score" | "revenue" | "opProfit" | "slaBurden";
type OwnershipFilter = "all" | "operating" | "jv";

export function CompositeRankingSection() {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [enabledTiers, setEnabledTiers] = useState<Tier[]>([...tierOrder]);
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");
  const { isActive } = useSelectedEntity();

  const maxScore = Math.max(...entities.map((e) => e.compositeScore));

  const rows = useMemo(() => {
    const filtered = entities.filter((e) => {
      if (!enabledTiers.includes(e.tier)) return false;
      if (ownership === "operating" && e.isJV) return false;
      if (ownership === "jv" && !e.isJV) return false;
      return true;
    });

    const sortFns: Record<SortKey, (a: typeof entities[0], b: typeof entities[0]) => number> = {
      score: (a, b) => a.compositeScore - b.compositeScore,
      revenue: (a, b) => b.revenue - a.revenue,
      opProfit: (a, b) => b.opProfit - a.opProfit,
      slaBurden: (a, b) => b.slaToOpProfit - a.slaToOpProfit,
    };

    const sorted = [...filtered].sort(sortFns[sortKey]);
    return direction === "asc" ? sorted : sorted.reverse();
  }, [sortKey, direction, enabledTiers, ownership]);

  const toggleTier = (t: Tier) => {
    setEnabledTiers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  return (
    <SectionShell
      id="composite"
      num="01"
      title={
        <>
          Composite Performance <em className="italic text-atlas-gold">Ranking</em>
        </>
      }
      description="Health score · lower = better"
    >
      <Card
        title="Weighted health index — 14 operating entities"
        subtitle="40% damage to op. profit · 25% op. margin · 20% SLA/revenue burden · 15% revenue scale penalty"
      >
        <Toolbar>
          <div className="flex flex-wrap items-center gap-4">
            <Segmented
              label="Sort"
              value={sortKey}
              onChange={setSortKey}
              options={[
                { value: "score", label: "Score" },
                { value: "revenue", label: "Revenue" },
                { value: "opProfit", label: "Op Profit" },
                { value: "slaBurden", label: "SLA Burden" },
              ]}
            />
            <Segmented
              value={direction}
              onChange={(v) => setDirection(v)}
              options={[
                { value: "asc", label: "Asc" },
                { value: "desc", label: "Desc" },
              ]}
            />
          </div>
          <Segmented
            label="Show"
            value={ownership}
            onChange={setOwnership}
            options={[
              { value: "all", label: "All" },
              { value: "operating", label: "Operating" },
              { value: "jv", label: "JVs" },
            ]}
          />
        </Toolbar>

        <div className="mb-5">
          <FilterChips
            label="Tiers"
            values={enabledTiers}
            onToggle={toggleTier}
            options={tierOrder.map((t) => ({
              value: t,
              label: tierMeta[t].label,
              dot: tierMeta[t].color,
            }))}
          />
        </div>

        <ul className="flex flex-col gap-0.5">
          {rows.map((e, idx) => {
            const severity = scoreToSeverity(e.compositeScore);
            const displayRank = idx + 1;
            const paddedRank = String(displayRank).padStart(2, "0");
            const barWidth = Math.max((e.compositeScore / maxScore) * 100, 6);
            const active = isActive(e.id);
            return (
              <li
                key={e.id}
                id={`entity-row-${e.id}`}
                className={`grid grid-cols-[40px_200px_1fr_80px_90px] items-center gap-4 rounded-sm px-3 py-2.5 transition-colors ${
                  active ? "bg-atlas-gold-soft" : "hover:bg-atlas-bg-3"
                }`}
              >
                <span
                  className={`text-center font-serif text-[28px] italic leading-none ${
                    displayRank <= 3 ? "text-atlas-gold" : displayRank >= rows.length - 1 ? "text-atlas-alert" : "text-atlas-ink-4"
                  }`}
                >
                  {paddedRank}
                </span>
                <EntityChip id={e.id} name={e.name} isJV={e.isJV} className="text-[15px]" />
                <div className="relative h-2 overflow-hidden rounded-full bg-atlas-bg-3">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barWidth}%`, background: severityGradient[severity] }}
                  />
                </div>
                <span className="text-right font-mono text-[13px] font-medium text-atlas-ink-2">
                  {sortKey === "revenue"
                    ? formatSAR(e.revenue)
                    : sortKey === "opProfit"
                      ? formatSAR(e.opProfit)
                      : sortKey === "slaBurden"
                        ? `${(e.slaToOpProfit * 100).toFixed(1)}%`
                        : e.compositeScore.toFixed(1)}
                </span>
                <div className="text-right">
                  <TierBadge tier={e.tier} />
                </div>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="py-10 text-center font-mono text-[11px] uppercase tracking-[1.5px] text-atlas-ink-3">
              No entities match current filters
            </li>
          )}
        </ul>

        <FilterNote>
          <strong className="text-atlas-ink">Score band legend:</strong> Strong &lt;25 · Healthy 25–40 ·
          Watch 40–50 · At Risk 50–80 · Critical &gt;80. Sort and tier filters are live — click any
          entity to highlight it across every section of this atlas.
        </FilterNote>
      </Card>
    </SectionShell>
  );
}
