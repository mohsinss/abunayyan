"use client";

import { useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  LabelList,
} from "recharts";
import { entities } from "@/lib/dashboard/data";
import { tierMeta } from "@/lib/dashboard/tokens";
import { formatSAR } from "@/lib/dashboard/derived";
import { Card, SectionShell } from "@/components/dashboard/section-shell";
import { Segmented, Toolbar } from "@/components/dashboard/chart-controls";
import {
  scrollToEntityRow,
  useSelectedEntity,
} from "@/components/dashboard/selected-entity-provider";

interface DotDatum {
  id: string;
  name: string;
  x: number;
  y: number;
  isJV: boolean;
  tier: keyof typeof tierMeta;
  revenue: number;
  opProfit: number;
  opMargin: number;
  slaToOpProfit: number;
  slaToRevenue: number;
  slaCost: number;
}

const dotData: DotDatum[] = entities.map((e) => ({
  id: e.id,
  name: e.name,
  x: 0,
  y: 0,
  isJV: e.isJV,
  tier: e.tier,
  revenue: e.revenue,
  opProfit: e.opProfit,
  opMargin: e.opMargin,
  slaToOpProfit: e.slaToOpProfit,
  slaToRevenue: e.slaToRevenue,
  slaCost: e.slaCost,
}));

function TooltipCard({ active, payload }: { active?: boolean; payload?: Array<{ payload: DotDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-sm border border-atlas-line bg-atlas-bg-2 px-3 py-2.5 font-mono text-[10px] shadow-md">
      <div className="mb-1 font-sans text-[12px] font-semibold text-atlas-ink">
        {d.name}
        {d.isJV && (
          <span className="ml-1.5 rounded-sm bg-atlas-gold-soft px-1 py-[1px] text-[8px] tracking-[1px] text-atlas-gold">
            JV
          </span>
        )}
      </div>
      <div className="space-y-0.5 text-atlas-ink-2">
        <div>Revenue: {formatSAR(d.revenue)}</div>
        <div>Op Profit: {formatSAR(d.opProfit)}</div>
        <div>Op Margin: {(d.opMargin * 100).toFixed(1)}%</div>
        <div>SLA: {formatSAR(d.slaCost)}</div>
        <div>SLA / OpP: {(d.slaToOpProfit * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
}

function ScatterPlot({
  xKey,
  yKey,
  xLabel,
  yLabel,
  xScale,
  xDomain,
  yDomain,
  xTickFormatter,
  yTickFormatter,
  showLabels,
  onDotClick,
}: {
  xKey: keyof DotDatum;
  yKey: keyof DotDatum;
  xLabel: string;
  yLabel: string;
  xScale: "linear" | "log";
  xDomain: [number, number];
  yDomain: [number, number];
  xTickFormatter: (v: number) => string;
  yTickFormatter: (v: number) => string;
  showLabels: boolean;
  onDotClick: (id: string) => void;
}) {
  const { isActive, hoverEntity } = useSelectedEntity();
  const data = dotData.map((d) => ({ ...d, x: d[xKey] as number, y: d[yKey] as number }));

  return (
    <div className="relative h-[440px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, bottom: 48, left: 52 }}>
          <CartesianGrid stroke="var(--atlas-line)" strokeDasharray="2 4" />
          <XAxis
            dataKey="x"
            type="number"
            scale={xScale}
            domain={xDomain}
            allowDataOverflow
            tickFormatter={xTickFormatter}
            tick={{ fontSize: 10, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
            stroke="var(--atlas-ink-4)"
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -32,
              style: {
                fontFamily: "var(--font-plex-mono)",
                fontSize: 10,
                fill: "var(--atlas-ink-2)",
                letterSpacing: "2px",
                textTransform: "uppercase",
              },
            }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={yDomain}
            tickFormatter={yTickFormatter}
            tick={{ fontSize: 10, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
            stroke="var(--atlas-ink-4)"
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              offset: -8,
              style: {
                fontFamily: "var(--font-plex-mono)",
                fontSize: 10,
                fill: "var(--atlas-ink-2)",
                letterSpacing: "2px",
                textTransform: "uppercase",
              },
            }}
          />
          <ZAxis range={[120, 120]} />
          <Tooltip content={<TooltipCard />} cursor={{ stroke: "var(--atlas-gold)", strokeWidth: 1, strokeDasharray: "2 2" }} />
          <Scatter
            data={data}
            onClick={(e) => onDotClick((e as unknown as DotDatum).id)}
            onMouseEnter={(e) => hoverEntity((e as unknown as DotDatum).id)}
            onMouseLeave={() => hoverEntity(null)}
            shape={(props: unknown) => {
              const p = props as { cx: number; cy: number; payload: DotDatum };
              const active = isActive(p.payload.id);
              const color = tierMeta[p.payload.tier].color;
              return (
                <g style={{ cursor: "pointer" }}>
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={active ? 10 : 7}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
                    style={{ filter: active ? "drop-shadow(0 0 6px rgba(139,111,46,0.6))" : "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
                  />
                </g>
              );
            }}
          >
            {showLabels && (
              <LabelList
                dataKey="name"
                position="right"
                style={{
                  fontFamily: "var(--font-plex-mono)",
                  fontSize: 10,
                  fill: "var(--atlas-ink)",
                }}
              />
            )}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QuadrantAnalysisSection() {
  const [xScaleA, setXScaleA] = useState<"linear" | "log">("log");
  const [labelsA, setLabelsA] = useState<"always" | "hover">("always");
  const [labelsB, setLabelsB] = useState<"always" | "hover">("always");
  const [layout, setLayout] = useState<"stacked" | "side-by-side">("stacked");
  const { selectEntity } = useSelectedEntity();

  const handleClick = (id: string) => {
    selectEntity(id);
    scrollToEntityRow(id);
  };

  return (
    <SectionShell
      id="quadrant"
      num="03"
      title={
        <>
          Quadrant <em className="italic text-atlas-gold">Analysis</em>
        </>
      }
      description="Where each SBU lives on two pain axes"
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
        <Card
          title="Damage vs Scale"
          subtitle="SLA impact to op. profit (y) against revenue size (x)"
        >
          <Toolbar>
            <Segmented
              label="X scale"
              value={xScaleA}
              onChange={setXScaleA}
              options={[
                { value: "log", label: "Log" },
                { value: "linear", label: "Linear" },
              ]}
            />
            <Segmented
              label="Labels"
              value={labelsA}
              onChange={setLabelsA}
              options={[
                { value: "always", label: "On" },
                { value: "hover", label: "Hover" },
              ]}
            />
          </Toolbar>
          <ScatterPlot
            xKey="revenue"
            yKey="slaToOpProfit"
            xLabel="Revenue FY2026 (SAR)"
            yLabel="SLA / Operating Profit"
            xScale={xScaleA}
            xDomain={xScaleA === "log" ? [50_000_000, 3_000_000_000] : [0, 2_000_000_000]}
            yDomain={[0, 2.2]}
            xTickFormatter={(v) => formatSAR(v)}
            yTickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            showLabels={labelsA === "always"}
            onDotClick={handleClick}
          />
          <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[9px] uppercase tracking-[1.2px] text-atlas-ink-3 md:grid-cols-3">
            <div>↖ Rescue zone</div>
            <div>↘ Scale wins</div>
            <div>↙ Small &amp; healthy</div>
          </div>
        </Card>

        <Card
          title="Margin vs Burden"
          subtitle="Operating margin (y) vs SLA as % of revenue (x)"
        >
          <Toolbar>
            <span className="font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink-3">
              Click a dot to highlight the entity everywhere
            </span>
            <Segmented
              label="Labels"
              value={labelsB}
              onChange={setLabelsB}
              options={[
                { value: "always", label: "On" },
                { value: "hover", label: "Hover" },
              ]}
            />
          </Toolbar>
          <ScatterPlot
            xKey="slaToRevenue"
            yKey="opMargin"
            xLabel="SLA / Revenue"
            yLabel="Op Margin"
            xScale="linear"
            xDomain={[0, 0.07]}
            yDomain={[0, 0.24]}
            xTickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
            yTickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            showLabels={labelsB === "always"}
            onDotClick={handleClick}
          />
          <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[9px] uppercase tracking-[1.2px] text-atlas-ink-3">
            <div>↖ Healthy · low burden</div>
            <div>↗ Healthy · high burden</div>
            <div>↙ Weak · protected</div>
            <div>↘ Killzone</div>
          </div>
        </Card>
      </div>
    </SectionShell>
  );
}
