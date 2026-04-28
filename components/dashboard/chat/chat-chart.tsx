"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartArgs {
  type: "bar" | "horizontal-bar" | "pie" | "scatter";
  title: string;
  description?: string;
  unit?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  data: Array<{
    label: string;
    value?: number;
    x?: number;
    y?: number;
    tone?: "positive" | "neutral" | "warn" | "negative";
  }>;
}

// Brand palette. Tones map to the dashboard's semantic colours
// (--good, --bad, --warn) and the default (neutral / unranked) sits on
// the brand-3 navy. The rank ramp is a 5-stop navy gradient — no more
// rainbow hsl() drift through green/yellow/red.
const NAVY_RAMP = ["#0b3378", "#2964a9", "#418cc0", "#7fb0d4", "#cfe0f3"] as const;
const toneColor: Record<NonNullable<ChartArgs["data"][0]["tone"]>, string> = {
  positive: "#0e8a5f",
  neutral: "#418cc0",
  warn: "#c98a2b",
  negative: "#c8463a",
};

function rampColor(t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const segs = NAVY_RAMP.length - 1;
  const idx = Math.min(segs, Math.floor(k * segs));
  return NAVY_RAMP[idx]!;
}

// If the model ships a verbose "unit" (> MAX_UNIT_LEN) we drop it from
// inline labels so the bar text stays readable. The full unit still
// shows up in the chart description / tooltips.
const MAX_UNIT_LEN = 10;

function cleanUnit(unit?: string): string {
  if (!unit) return "";
  const trimmed = unit.trim();
  if (trimmed.length > MAX_UNIT_LEN) return "";
  return trimmed;
}

function formatValue(v: number | undefined, unit?: string): string {
  if (v === undefined) return "";
  const u = cleanUnit(unit);
  const suffix = u ? ` ${u}` : "";
  const abs = Math.abs(v);
  if (u === "%") return `${(v * (abs > 1 ? 1 : 100)).toFixed(1)}%`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B${suffix}`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M${suffix}`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K${suffix}`;
  return `${v.toFixed(abs < 10 && abs > 0 ? 2 : 0)}${suffix}`;
}

// Truncate a label with an ellipsis. The full string is kept on a
// <title> element so the browser tooltip shows the untruncated text.
const MAX_LABEL_LEN = 22;

function truncate(s: string, max = MAX_LABEL_LEN): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// Custom Recharts YAxis tick for horizontal bars. Truncates overflow
// and exposes the full label via SVG <title> on hover.
function HorizontalBarTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const raw = String(props.payload?.value ?? "");
  const shown = truncate(raw);
  return (
    <g transform={`translate(${props.x},${props.y})`}>
      <text
        x={-6}
        y={0}
        dy={3}
        textAnchor="end"
        fontFamily="var(--font-plex-sans)"
        fontSize={11}
        fill="var(--atlas-ink)"
      >
        {shown}
        {raw !== shown && <title>{raw}</title>}
      </text>
    </g>
  );
}

// Vertical (bottom-axis) tick with rotation + truncation for many categories.
function BottomCategoryTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  rotate?: boolean;
}) {
  const raw = String(props.payload?.value ?? "");
  const shown = truncate(raw, props.rotate ? 14 : 18);
  return (
    <g transform={`translate(${props.x},${props.y})`}>
      <text
        x={0}
        y={0}
        dy={props.rotate ? 4 : 14}
        textAnchor={props.rotate ? "end" : "middle"}
        transform={props.rotate ? "rotate(-30)" : undefined}
        fontFamily="var(--font-plex-mono)"
        fontSize={9}
        fill="var(--atlas-ink-3)"
      >
        {shown}
        {raw !== shown && <title>{raw}</title>}
      </text>
    </g>
  );
}

function rankColor(i: number, total: number, tone?: ChartArgs["data"][0]["tone"]): string {
  if (tone) return toneColor[tone];
  if (total <= 1) return NAVY_RAMP[0]!;
  return rampColor(i / (total - 1));
}

const tooltipStyle = {
  border: "1px solid var(--atlas-line)",
  backgroundColor: "var(--atlas-bg-2)",
  fontFamily: "var(--font-plex-mono)",
  fontSize: 10,
  borderRadius: 2,
  padding: "6px 10px",
};

export function ChatChart({ args }: { args: ChartArgs }) {
  const { type, title, description, unit, data } = args;
  // Sort for bar/horizontal-bar: descending by value.
  const sorted =
    type === "bar" || type === "horizontal-bar"
      ? [...data].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      : data;

  return (
    <figure className="my-3 overflow-hidden rounded-sm border border-atlas-line bg-atlas-bg-2">
      <figcaption className="border-b border-atlas-line px-3 py-2">
        <div className="font-serif text-[13px] font-medium text-atlas-ink">{title}</div>
        {description && (
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-atlas-ink-3">
            {description}
          </div>
        )}
      </figcaption>
      <div className="px-2 py-3">
        {type === "horizontal-bar" && (
          <ResponsiveContainer width="100%" height={Math.max(sorted.length * 26 + 20, 120)}>
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 4, right: 72, bottom: 4, left: 8 }}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="label"
                type="category"
                width={150}
                tick={<HorizontalBarTick />}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "var(--atlas-bg-3)" }}
                contentStyle={tooltipStyle}
                labelFormatter={(l) => String(l)}
                formatter={(v) => [formatValue(Number(v), unit), ""]}
              />
              <Bar
                dataKey="value"
                radius={[0, 2, 2, 0]}
                label={{
                  position: "right",
                  formatter: (v: unknown) => formatValue(Number(v), unit),
                  fontFamily: "var(--font-plex-mono)",
                  fontSize: 10,
                  fill: "var(--atlas-ink-2)",
                }}
              >
                {sorted.map((d, i) => (
                  <Cell key={d.label} fill={rankColor(i, sorted.length, d.tone)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {type === "bar" && (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart
              data={sorted}
              margin={{
                top: 8,
                right: 8,
                bottom: sorted.length > 6 ? 56 : 24,
                left: 8,
              }}
            >
              <XAxis
                dataKey="label"
                tick={<BottomCategoryTick rotate={sorted.length > 6} />}
                axisLine={{ stroke: "var(--atlas-line-2)" }}
                tickLine={false}
                interval={0}
                height={sorted.length > 6 ? 56 : 24}
              />
              <YAxis
                tick={{ fontSize: 9, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatValue(v, unit)}
                width={48}
              />
              <Tooltip
                cursor={{ fill: "var(--atlas-bg-3)" }}
                contentStyle={tooltipStyle}
                labelFormatter={(l) => String(l)}
                formatter={(v) => [formatValue(Number(v), unit), ""]}
              />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {sorted.map((d, i) => (
                  <Cell key={d.label} fill={rankColor(i, sorted.length, d.tone)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {type === "pie" && (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, _n, _item) => {
                  const total = data.reduce((s, d) => s + (d.value ?? 0), 0);
                  const share = total ? Number(v) / total : 0;
                  return [`${formatValue(Number(v), unit)} · ${(share * 100).toFixed(1)}%`, ""];
                }}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={45}
                outerRadius={95}
                paddingAngle={1}
                label={({ label, percent }: { label?: string; percent?: number }) =>
                  percent !== undefined && percent > 0.05 ? `${label}` : ""
                }
                labelLine={false}
                style={{
                  fontFamily: "var(--font-plex-mono)",
                  fontSize: 9,
                  fill: "var(--atlas-ink-2)",
                }}
              >
                {data.map((d, i) => (
                  <Cell key={d.label} fill={rankColor(i, data.length, d.tone)} stroke="white" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}

        {type === "scatter" && (
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 10, right: 16, bottom: 28, left: 40 }}>
              <XAxis
                dataKey="x"
                type="number"
                tick={{ fontSize: 9, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
                stroke="var(--atlas-line-2)"
                label={
                  args.xAxisLabel
                    ? {
                        value: args.xAxisLabel,
                        position: "insideBottom",
                        offset: -18,
                        style: { fontFamily: "var(--font-plex-mono)", fontSize: 9, fill: "var(--atlas-ink-2)" },
                      }
                    : undefined
                }
                tickFormatter={(v) => formatValue(v, unit)}
              />
              <YAxis
                dataKey="y"
                type="number"
                tick={{ fontSize: 9, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
                stroke="var(--atlas-line-2)"
                label={
                  args.yAxisLabel
                    ? {
                        value: args.yAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                        style: { fontFamily: "var(--font-plex-mono)", fontSize: 9, fill: "var(--atlas-ink-2)" },
                      }
                    : undefined
                }
                tickFormatter={(v) => formatValue(v, unit)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [formatValue(Number(v), unit), name]}
                labelFormatter={(_l, payload) =>
                  (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? ""
                }
              />
              <Scatter
                data={data}
                shape={(props: unknown) => {
                  const p = props as { cx: number; cy: number; payload: ChartArgs["data"][0] };
                  const fill = p.payload.tone ? toneColor[p.payload.tone] : "#418cc0";
                  return (
                    <g>
                      <circle cx={p.cx} cy={p.cy} r={6} fill={fill} stroke="white" strokeWidth={1.5} />
                      <text
                        x={p.cx + 8}
                        y={p.cy + 3}
                        fontSize={9}
                        fontFamily="var(--font-plex-mono)"
                        fill="var(--atlas-ink)"
                      >
                        {p.payload.label}
                      </text>
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}
