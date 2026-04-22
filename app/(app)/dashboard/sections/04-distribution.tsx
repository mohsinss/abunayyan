"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { entities } from "@/lib/dashboard/data";
import { formatSAR, totalOpProfit, totalRevenue } from "@/lib/dashboard/derived";
import { Card, FilterNote, SectionShell } from "@/components/dashboard/section-shell";
import { Segmented, Toolbar } from "@/components/dashboard/chart-controls";
import {
  scrollToEntityRow,
  useSelectedEntity,
} from "@/components/dashboard/selected-entity-provider";

type ViewMode = "bar" | "treemap" | "donut";
type SortMode = "value" | "alpha";

const DIST_COLORS = [
  "var(--atlas-ok)",
  "var(--atlas-ok-2)",
  "#a8b876",
  "var(--atlas-accent-2)",
  "var(--atlas-accent)",
  "var(--atlas-warn)",
  "#d48543",
  "var(--atlas-alert)",
  "#c44536",
];

function colorForRank(rank: number, total: number) {
  const idx = Math.floor((rank / total) * DIST_COLORS.length);
  return DIST_COLORS[Math.min(idx, DIST_COLORS.length - 1)];
}

function Chart({
  data,
  view,
  onClick,
}: {
  data: Array<{ id: string; name: string; value: number; share: number; isJV: boolean }>;
  view: ViewMode;
  onClick: (id: string) => void;
}) {
  const { isActive, hoverEntity } = useSelectedEntity();

  if (view === "bar") {
    return (
      <ResponsiveContainer width="100%" height={data.length * 34 + 20}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 80, bottom: 4, left: 110 }}
          barCategoryGap={4}
        >
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            width={110}
            tick={{ fontSize: 12, fontFamily: "var(--font-plex-sans)", fill: "var(--atlas-ink)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--atlas-bg-3)" }}
            contentStyle={{
              border: "1px solid var(--atlas-line)",
              backgroundColor: "var(--atlas-bg-2)",
              fontFamily: "var(--font-plex-mono)",
              fontSize: 11,
              borderRadius: 2,
            }}
            formatter={(v) => [formatSAR(Number(v)), "Value"]}
          />
          <Bar
            dataKey="value"
            onClick={(d) => onClick((d as unknown as { id: string }).id)}
            onMouseEnter={(d) => hoverEntity((d as unknown as { id: string }).id)}
            onMouseLeave={() => hoverEntity(null)}
            radius={[0, 2, 2, 0]}
            label={{
              position: "right",
              formatter: (v: unknown) => formatSAR(v as number),
              fontFamily: "var(--font-plex-mono)",
              fontSize: 10,
              fill: "var(--atlas-ink-3)",
            }}
          >
            {data.map((d, i) => (
              <Cell
                key={d.id}
                fill={colorForRank(i, data.length)}
                style={{
                  cursor: "pointer",
                  opacity: isActive(d.id) ? 1 : 0.9,
                  stroke: isActive(d.id) ? "var(--atlas-gold)" : "transparent",
                  strokeWidth: 2,
                }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (view === "treemap") {
    return (
      <ResponsiveContainer width="100%" height={420}>
        <Treemap
          data={data.map((d, i) => ({ ...d, fill: colorForRank(i, data.length) }))}
          dataKey="value"
          nameKey="name"
          stroke="white"
          content={(props: unknown) => {
            const p = props as {
              x: number;
              y: number;
              width: number;
              height: number;
              name?: string;
              value?: number;
              fill?: string;
              id?: string;
            };
            return (
              <g
                style={{ cursor: "pointer" }}
                onClick={() => p.id && onClick(p.id)}
                onMouseEnter={() => p.id && hoverEntity(p.id)}
                onMouseLeave={() => hoverEntity(null)}
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.width}
                  height={p.height}
                  fill={p.fill || "var(--atlas-bg-3)"}
                  stroke={p.id && isActive(p.id) ? "var(--atlas-gold)" : "white"}
                  strokeWidth={p.id && isActive(p.id) ? 3 : 1}
                />
                {p.width > 60 && p.height > 30 && (
                  <>
                    <text
                      x={p.x + 8}
                      y={p.y + 20}
                      fill="white"
                      fontFamily="var(--font-plex-sans)"
                      fontSize={12}
                      fontWeight={600}
                    >
                      {p.name}
                    </text>
                    <text
                      x={p.x + 8}
                      y={p.y + 36}
                      fill="white"
                      fontFamily="var(--font-plex-mono)"
                      fontSize={10}
                    >
                      {formatSAR(p.value || 0)}
                    </text>
                  </>
                )}
              </g>
            );
          }}
        />
      </ResponsiveContainer>
    );
  }

  // donut
  return (
    <ResponsiveContainer width="100%" height={420}>
      <PieChart>
        <Tooltip
          contentStyle={{
            border: "1px solid var(--atlas-line)",
            backgroundColor: "var(--atlas-bg-2)",
            fontFamily: "var(--font-plex-mono)",
            fontSize: 11,
            borderRadius: 2,
          }}
          formatter={(v, _name, item) => {
            const p = (item as { payload?: { share?: number } }).payload;
            return [`${formatSAR(Number(v))} · ${((p?.share ?? 0) * 100).toFixed(1)}%`, "Value"];
          }}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={80}
          outerRadius={170}
          paddingAngle={1}
          onClick={(d) => onClick((d as unknown as { id: string }).id)}
          onMouseEnter={(d) => hoverEntity((d as unknown as { id: string }).id)}
          onMouseLeave={() => hoverEntity(null)}
          label={({ name, share }: { name?: string; share?: number }) =>
            share !== undefined && share > 0.04 ? `${name}` : ""
          }
          labelLine={false}
          style={{
            fontFamily: "var(--font-plex-mono)",
            fontSize: 10,
            fill: "var(--atlas-ink-2)",
          }}
        >
          {data.map((d, i) => (
            <Cell
              key={d.id}
              fill={colorForRank(i, data.length)}
              stroke={isActive(d.id) ? "var(--atlas-gold)" : "white"}
              strokeWidth={isActive(d.id) ? 3 : 1}
              style={{ cursor: "pointer" }}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

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
  const [view, setView] = useState<ViewMode>("bar");
  const [sort, setSort] = useState<SortMode>("value");
  const [excludeWetico, setExcludeWetico] = useState<"all" | "no-wetico">("all");
  const { selectEntity } = useSelectedEntity();

  const total = metric === "revenue" ? totalRevenue() : totalOpProfit();

  const data = useMemo(() => {
    let list = entities.map((e) => ({
      id: e.id,
      name: e.name,
      value: metric === "revenue" ? e.revenue : e.opProfit,
      share: (metric === "revenue" ? e.revenue : e.opProfit) / total,
      isJV: e.isJV,
    }));
    if (excludeWetico === "no-wetico") list = list.filter((d) => d.id !== "wetico");
    if (sort === "value") list.sort((a, b) => b.value - a.value);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [metric, sort, excludeWetico, total]);

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
            { value: "treemap", label: "Treemap" },
            { value: "donut", label: "Donut" },
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

      <Chart data={data} view={view} onClick={onClick} />

      <FilterNote>{note}</FilterNote>
    </Card>
  );
}

export function DistributionSection() {
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
