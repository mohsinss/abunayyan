"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { entities } from "@/lib/dashboard/data";
import { formatSAR } from "@/lib/dashboard/derived";
import { Card, FilterNote, SectionShell } from "@/components/dashboard/section-shell";
import { Segmented, Toolbar } from "@/components/dashboard/chart-controls";
import {
  scrollToEntityRow,
  useSelectedEntity,
} from "@/components/dashboard/selected-entity-provider";

type ViewMode = "bar" | "pareto" | "donut" | "radial" | "treemap";
type SortMode = "value" | "alpha";

// Same diverging HSL scale as the cost matrix, but inverted semantically:
// high revenue / profit = GREEN (healthy), low = RED (thin). Input t is
// "position in the sorted list" (0 = biggest, 1 = smallest). We map that
// directly: t=0 → deep green, t=0.5 → yellow/amber, t=1 → deep red.
function distributionColor(t: number): string {
  const k = Math.max(0, Math.min(1, t));
  let h: number;
  let s: number;
  let l: number;
  if (k <= 0.5) {
    const a = k * 2; // 0 → green to yellow
    h = 110 - a * 60; // 110 (green) → 50 (yellow)
    s = 55 + a * 25; // 55% → 80%
    l = 48 - a * 5; // 48% → 43%
  } else {
    const a = (k - 0.5) * 2; // yellow to red
    h = 50 - a * 45; // 50 → 5
    s = 80 + a * 10; // 80% → 90%
    l = 48 - a * 10; // 48% → 38%
  }
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function colorForRank(rank: number, total: number) {
  if (total <= 1) return distributionColor(0);
  return distributionColor(rank / (total - 1));
}

type ChartDatum = {
  id: string;
  name: string;
  value: number;
  share: number;
  isJV: boolean;
};

// Outside-label renderer for donut. Places entity name + percent share at the
// end of a short leader line so every slice is readable even when they are
// thin (small SBUs in the long tail).
function renderDonutLabel(props: unknown) {
  const p = props as {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    name?: string;
    payload?: { share?: number };
  };
  const share = p.payload?.share ?? 0;
  if (share < 0.01) return null;
  const RAD = Math.PI / 180;
  const sin = Math.sin(-p.midAngle * RAD);
  const cos = Math.cos(-p.midAngle * RAD);
  const elbow = { x: p.cx + (p.outerRadius + 10) * cos, y: p.cy + (p.outerRadius + 10) * sin };
  const endX = p.cx + (p.outerRadius + 28) * cos;
  const endY = p.cy + (p.outerRadius + 28) * sin;
  const labelX = endX + (cos >= 0 ? 4 : -4);
  const anchor = cos >= 0 ? "start" : "end";
  return (
    <g style={{ pointerEvents: "none" }}>
      <polyline
        points={`${elbow.x},${elbow.y} ${endX},${endY} ${labelX},${endY}`}
        fill="none"
        stroke="var(--atlas-line-2)"
        strokeWidth={0.75}
      />
      <text
        x={labelX}
        y={endY}
        dy={3}
        textAnchor={anchor}
        fontFamily="var(--font-plex-sans)"
        fontSize={11}
        fill="var(--atlas-ink)"
      >
        <tspan fontWeight={500}>{p.name}</tspan>
        <tspan
          dx={4}
          fontFamily="var(--font-plex-mono)"
          fontSize={10}
          fill="var(--atlas-ink-3)"
        >
          {(share * 100).toFixed(1)}%
        </tspan>
      </text>
    </g>
  );
}

function Chart({
  data,
  view,
  total,
  onClick,
}: {
  data: ChartDatum[];
  view: ViewMode;
  total: number;
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

  if (view === "pareto") {
    // Always sort desc by value for Pareto, regardless of outer sort. A
    // Pareto plot only makes sense in descending order — the cumulative
    // line would zig-zag otherwise.
    const sorted = [...data].sort((a, b) => b.value - a.value);
    let running = 0;
    const paretoData = sorted.map((d) => {
      running += d.value;
      return { ...d, cumPct: total > 0 ? (running / total) * 100 : 0 };
    });
    return (
      <ResponsiveContainer width="100%" height={420}>
        <ComposedChart
          data={paretoData}
          margin={{ top: 16, right: 56, bottom: 56, left: 8 }}
        >
          <XAxis
            dataKey="name"
            tick={{
              fontSize: 10,
              fontFamily: "var(--font-plex-mono)",
              fill: "var(--atlas-ink-2)",
            }}
            axisLine={{ stroke: "var(--atlas-line-2)" }}
            tickLine={false}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={56}
          />
          <YAxis
            yAxisId="left"
            tick={{
              fontSize: 9,
              fontFamily: "var(--font-plex-mono)",
              fill: "var(--atlas-ink-3)",
            }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatSAR(v as number)}
            width={68}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{
              fontSize: 9,
              fontFamily: "var(--font-plex-mono)",
              fill: "var(--atlas-ink-3)",
            }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={40}
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
            formatter={(v, name) => {
              if (name === "cumPct") return [`${Number(v).toFixed(1)}%`, "Cumulative"];
              return [formatSAR(Number(v)), "Value"];
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="value"
            radius={[2, 2, 0, 0]}
            onClick={(d) => onClick((d as unknown as { id: string }).id)}
            onMouseEnter={(d) => hoverEntity((d as unknown as { id: string }).id)}
            onMouseLeave={() => hoverEntity(null)}
          >
            {paretoData.map((d, i) => (
              <Cell
                key={d.id}
                fill={colorForRank(i, paretoData.length)}
                style={{
                  cursor: "pointer",
                  stroke: isActive(d.id) ? "var(--atlas-gold)" : "transparent",
                  strokeWidth: 2,
                }}
              />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumPct"
            stroke="var(--atlas-ink)"
            strokeWidth={1.5}
            dot={{ r: 3, fill: "var(--atlas-bg-2)", strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (view === "radial") {
    // Radial bar: each entity gets a concentric arc whose length encodes
    // its share of total. Largest share maps to a full ring so the
    // remaining arcs stay visually proportional.
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const maxShare = sorted[0]?.share ?? 1;
    const radialData = sorted.map((d, i) => ({
      ...d,
      pct: d.share * 100,
      fill: colorForRank(i, sorted.length),
    }));
    return (
      <ResponsiveContainer width="100%" height={460}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="18%"
          outerRadius="95%"
          barSize={Math.max(10, 200 / Math.max(1, radialData.length))}
          data={radialData}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, Math.max(1, maxShare * 100)]}
            tick={false}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid var(--atlas-line)",
              backgroundColor: "var(--atlas-bg-2)",
              fontFamily: "var(--font-plex-mono)",
              fontSize: 11,
              borderRadius: 2,
            }}
            formatter={(_v, _name, item) => {
              const p = (item as { payload?: ChartDatum }).payload;
              return [
                `${formatSAR(p?.value ?? 0)} · ${((p?.share ?? 0) * 100).toFixed(1)}%`,
                p?.name ?? "",
              ];
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ paddingLeft: 12 }}
            content={() => (
              <ul className="m-0 list-none p-0 font-mono text-[10px] text-atlas-ink-2">
                {radialData.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 py-[2px]">
                    <span
                      className="inline-block h-2 w-2 shrink-0"
                      style={{ backgroundColor: d.fill }}
                    />
                    <span className="text-atlas-ink">{d.name}</span>
                    <span className="text-atlas-ink-3">
                      {(d.share * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          />
          <RadialBar
            dataKey="pct"
            background={{ fill: "var(--atlas-bg-3)" }}
            cornerRadius={2}
            onClick={(d) => onClick((d as unknown as { id: string }).id)}
            onMouseEnter={(d) => hoverEntity((d as unknown as { id: string }).id)}
            onMouseLeave={() => hoverEntity(null)}
            isAnimationActive={false}
          >
            {radialData.map((d) => (
              <Cell
                key={d.id}
                fill={d.fill}
                stroke={isActive(d.id) ? "var(--atlas-gold)" : "transparent"}
                strokeWidth={isActive(d.id) ? 2 : 0}
                style={{ cursor: "pointer" }}
              />
            ))}
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
    );
  }

  // donut
  return (
    <ResponsiveContainer width="100%" height={460}>
      <PieChart margin={{ top: 20, right: 120, bottom: 20, left: 120 }}>
        <Tooltip
          contentStyle={{
            border: "1px solid var(--atlas-line)",
            backgroundColor: "var(--atlas-bg-2)",
            fontFamily: "var(--font-plex-mono)",
            fontSize: 11,
            borderRadius: 2,
          }}
          formatter={(v, _name, item) => {
            const p = (item as { payload?: { share?: number; name?: string } }).payload;
            return [
              `${formatSAR(Number(v))} · ${((p?.share ?? 0) * 100).toFixed(1)}%`,
              p?.name ?? "Value",
            ];
          }}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={88}
          outerRadius={150}
          paddingAngle={1}
          onClick={(d) => onClick((d as unknown as { id: string }).id)}
          onMouseEnter={(d) => hoverEntity((d as unknown as { id: string }).id)}
          onMouseLeave={() => hoverEntity(null)}
          label={renderDonutLabel}
          labelLine={false}
          isAnimationActive={false}
        >
          {data.map((d, i) => (
            <Cell
              key={d.id}
              fill={colorForRank(i, data.length)}
              stroke={isActive(d.id) ? "var(--atlas-gold)" : "var(--atlas-bg-2)"}
              strokeWidth={isActive(d.id) ? 3 : 1.5}
              style={{ cursor: "pointer" }}
            />
          ))}
        </Pie>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy={-6}
          fontFamily="var(--font-plex-mono)"
          fontSize={9}
          letterSpacing={1.5}
          fill="var(--atlas-ink-3)"
        >
          TOTAL
        </text>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy={14}
          fontFamily="var(--font-plex-sans)"
          fontSize={16}
          fontWeight={600}
          fill="var(--atlas-ink)"
        >
          {formatSAR(total)}
        </text>
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

  const { data, displayedTotal } = useMemo(() => {
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

      <Chart data={data} view={view} total={displayedTotal} onClick={onClick} />

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
