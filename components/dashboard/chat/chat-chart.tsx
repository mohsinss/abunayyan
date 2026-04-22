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

const toneColor: Record<NonNullable<ChartArgs["data"][0]["tone"]>, string> = {
  positive: "var(--atlas-ok)",
  neutral: "var(--atlas-gold)",
  warn: "var(--atlas-warn)",
  negative: "var(--atlas-alert)",
};

function hsl(t: number): string {
  const k = Math.max(0, Math.min(1, t));
  if (k <= 0.5) {
    const a = k * 2;
    return `hsl(${110 - a * 60}, ${55 + a * 25}%, ${48 - a * 5}%)`;
  }
  const a = (k - 0.5) * 2;
  return `hsl(${50 - a * 45}, ${80 + a * 10}%, ${48 - a * 10}%)`;
}

function formatValue(v: number | undefined, unit?: string): string {
  if (v === undefined) return "";
  const abs = Math.abs(v);
  if (unit === "%") return `${(v * (abs > 1 ? 1 : 100)).toFixed(1)}%`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B${unit ? ` ${unit}` : ""}`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M${unit ? ` ${unit}` : ""}`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K${unit ? ` ${unit}` : ""}`;
  return `${v.toFixed(abs < 10 && abs > 0 ? 2 : 0)}${unit ? ` ${unit}` : ""}`;
}

function rankColor(i: number, total: number, tone?: ChartArgs["data"][0]["tone"]): string {
  if (tone) return toneColor[tone];
  if (total <= 1) return hsl(0);
  return hsl(i / (total - 1));
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
          <ResponsiveContainer width="100%" height={Math.max(sorted.length * 24 + 20, 120)}>
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 4, right: 60, bottom: 4, left: 70 }}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="label"
                type="category"
                width={70}
                tick={{ fontSize: 10, fontFamily: "var(--font-plex-sans)", fill: "var(--atlas-ink)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--atlas-bg-3)" }}
                contentStyle={tooltipStyle}
                formatter={(v) => [formatValue(Number(v), unit), ""]}
              />
              <Bar
                dataKey="value"
                radius={[0, 2, 2, 0]}
                label={{
                  position: "right",
                  formatter: (v: unknown) => formatValue(Number(v), unit),
                  fontFamily: "var(--font-plex-mono)",
                  fontSize: 9,
                  fill: "var(--atlas-ink-3)",
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
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sorted} margin={{ top: 8, right: 8, bottom: 18, left: 8 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
                axisLine={{ stroke: "var(--atlas-line-2)" }}
                tickLine={false}
                interval={0}
                angle={sorted.length > 6 ? -30 : 0}
                textAnchor={sorted.length > 6 ? "end" : "middle"}
                height={sorted.length > 6 ? 48 : 20}
              />
              <YAxis
                tick={{ fontSize: 9, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatValue(v, unit)}
              />
              <Tooltip
                cursor={{ fill: "var(--atlas-bg-3)" }}
                contentStyle={tooltipStyle}
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
                formatter={(v, _n, item) => {
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
                  const fill = p.payload.tone ? toneColor[p.payload.tone] : "var(--atlas-gold)";
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
