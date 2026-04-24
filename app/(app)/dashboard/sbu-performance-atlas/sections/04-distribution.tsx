"use client";

import { useMemo, useState } from "react";
import { entities } from "@/lib/dashboard/data";
import { Card, FilterNote, SectionShell } from "@/components/dashboard/section-shell";
import { Segmented, Toolbar } from "@/components/dashboard/chart-controls";
import {
  scrollToEntityRow,
  useSelectedEntity,
} from "@/components/dashboard/selected-entity-provider";
import {
  DistributionChart,
  type ChartDatum,
  type DistributionView,
} from "@/components/dashboard/distribution";

type SortMode = "value" | "alpha";

function DistributionPanel({
  title,
  subtitle,
  metric,
  note,
}: {
  title: string;
  subtitle: string;
  metric: "revenue" | "opProfit";
  note: React.ReactNode;
}) {
  const [view, setView] = useState<DistributionView>("bar");
  const [sort, setSort] = useState<SortMode>("value");
  const [excludeWetico, setExcludeWetico] = useState<"all" | "no-wetico">("all");
  const { selectEntity } = useSelectedEntity();

  const { data, displayedTotal } = useMemo<{
    data: ChartDatum[];
    displayedTotal: number;
  }>(() => {
    let list = entities.map((e) => ({
      id: e.id,
      name: e.name,
      value: metric === "revenue" ? e.revenue : e.opProfit,
      isJV: e.isJV,
    }));
    if (excludeWetico === "no-wetico") list = list.filter((d) => d.id !== "wetico");
    const subtotal = list.reduce((s, d) => s + d.value, 0);
    const withShare = list.map((d) => ({
      ...d,
      share: subtotal > 0 ? d.value / subtotal : 0,
    }));
    if (sort === "value") withShare.sort((a, b) => b.value - a.value);
    else withShare.sort((a, b) => a.name.localeCompare(b.name));
    return { data: withShare, displayedTotal: subtotal };
  }, [metric, sort, excludeWetico]);

  const onClick = (id: string) => {
    selectEntity(id);
    scrollToEntityRow(id);
  };

  return (
    <Card title={title} subtitle={subtitle}>
      <Toolbar>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "bar", label: "Bars" },
            { value: "pareto", label: "Pareto" },
            { value: "donut", label: "Donut" },
            { value: "radial", label: "Radial" },
            { value: "treemap", label: "Treemap" },
          ]}
        />
        <div className="flex items-center gap-3">
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "value", label: "Value" },
              { value: "alpha", label: "A–Z" },
            ]}
          />
          <Segmented
            value={excludeWetico}
            onChange={setExcludeWetico}
            options={[
              { value: "all", label: "All" },
              { value: "no-wetico", label: "No Wetico" },
            ]}
          />
        </div>
      </Toolbar>

      <DistributionChart data={data} view={view} total={displayedTotal} onClick={onClick} />

      <FilterNote>{note}</FilterNote>
    </Card>
  );
}

export function DistributionSection() {
  const [layout, setLayout] = useState<"stacked" | "side-by-side">("stacked");

  return (
    <SectionShell
      id="distribution"
      num="04"
      title={
        <>
          Revenue &amp; Profit <em className="italic text-atlas-gold">Distribution</em>
        </>
      }
      description="Absolute scale · relative concentration"
    >
      <div className="mb-4 flex justify-end">
        <Segmented
          label="Layout"
          value={layout}
          onChange={setLayout}
          options={[
            { value: "stacked", label: "Stacked" },
            { value: "side-by-side", label: "Side by side" },
          ]}
        />
      </div>
      <div
        className={`grid gap-5 ${
          layout === "side-by-side" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        <DistributionPanel
          title="Revenue FY2026"
          subtitle="Distribution across 14 operating entities"
          metric="revenue"
          note={
            <>
              Top 4 SBUs represent <strong className="text-atlas-ink">79.8% of group revenue</strong>.
              Bottom 6 represent only 12.1% but consume 30.8% of SLA cost — structural
              over-allocation.
            </>
          }
        />
        <DistributionPanel
          title="Operating Profit FY2026"
          subtitle="Pre-SLA distribution · 474.5M aggregate"
          metric="opProfit"
          note={
            <>
              Wetico alone generates{" "}
              <strong className="text-atlas-ink">45.6% of group operating profit</strong>. It
              subsidizes the rest of the portfolio — protect operations · avoid unproven AI pilots
              that risk disruption.
            </>
          }
        />
      </div>
    </SectionShell>
  );
}
