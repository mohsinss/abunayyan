"use client";

// Enlarged, fully-labelled version of a chat chart, shown as an overlay
// when the inline figure is clicked. Adds grid lines, axis labels, value
// labels on every mark, legend, share percentages, and the underlying
// data table. Closes on backdrop click, the X button, or Escape.

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartArgs } from "./chat-chart";

const BRAND_PRIMARY = "#0b3378";
const BRAND_CYCLE = ["#0b3378", "#418cc0", "#7f7f7f", "#c98a2b", "#2964a9"] as const;
const TONE_COLOR: Record<NonNullable<ChartArgs["data"][0]["tone"]>, string> = {
  positive: "#0e8a5f",
  neutral: "#418cc0",
  warn: "#c98a2b",
  negative: "#c8463a",
};

function fmt(v: number | undefined, unit?: string): string {
  if (v === undefined) return "—";
  const u = unit?.trim() ?? "";
  const suffix = u && u.length <= 10 ? ` ${u}` : "";
  const abs = Math.abs(v);
  if (u === "%") return `${(v * (abs > 1 ? 1 : 100)).toFixed(1)}%`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B${suffix}`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M${suffix}`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K${suffix}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: abs < 10 ? 2 : 0 })}${suffix}`;
}

const tooltipStyle = {
  border: "1px solid #e3e8f1",
  backgroundColor: "#ffffff",
  fontFamily: "var(--font-plex-mono)",
  fontSize: 11,
  borderRadius: 4,
  padding: "8px 12px",
};

export function ChatChartModal({ args, onClose }: { args: ChartArgs; onClose: () => void }) {
  const { type, title, description, unit, data } = args;
  const sorted =
    type === "bar" || type === "horizontal-bar"
      ? [...data].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      : data;
  const total = data.reduce((s, d) => s + (d.value ?? 0), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const barColor = (tone?: ChartArgs["data"][0]["tone"]) =>
    tone ? TONE_COLOR[tone] : BRAND_PRIMARY;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(11, 34, 79, 0.45)", backdropFilter: "blur(4px)" }}
      // stopPropagation: the modal lives inside the clickable figure —
      // without it, the backdrop click would bubble up and re-open.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        style={{ border: "1px solid #e3e8f1" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "#e3e8f1" }}>
          <div>
            <div className="font-serif text-[17px] font-semibold" style={{ color: "#1a2233" }}>
              {title}
            </div>
            {description && (
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[1.2px]" style={{ color: "#4a5568" }}>
                {description}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge>{type}</Badge>
              {unit && <Badge>unit: {unit}</Badge>}
              <Badge>{data.length} points</Badge>
              {(type === "pie" || type === "bar" || type === "horizontal-bar") && total > 0 && (
                <Badge>total: {fmt(total, unit)}</Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[#f0f6fd]"
            style={{ color: "#4a5568" }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Chart */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-4 py-4">
            {type === "horizontal-bar" && (
              <ResponsiveContainer width="100%" height={Math.max(sorted.length * 38 + 40, 260)}>
                <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 96, bottom: 8, left: 12 }}>
                  <CartesianGrid horizontal={false} stroke="#eef2f8" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fontFamily: "var(--font-plex-mono)", fill: "#4a5568" }}
                    tickFormatter={(v) => fmt(Number(v), unit)}
                    stroke="#dde3ee"
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={190}
                    tick={{ fontSize: 12, fontFamily: "var(--font-plex-sans)", fill: "#1a2233" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <Tooltip
                    cursor={{ fill: "#f4f6fb" }}
                    contentStyle={tooltipStyle}
                    formatter={(v) => [
                      `${fmt(Number(v), unit)}${total > 0 ? ` · ${((Number(v) / total) * 100).toFixed(1)}% of total` : ""}`,
                      "",
                    ]}
                  />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: unknown) => fmt(Number(v), unit)}
                      style={{ fontFamily: "var(--font-plex-mono)", fontSize: 11, fill: "#1a2233" }}
                    />
                    {sorted.map((d) => (
                      <Cell key={d.label} fill={barColor(d.tone)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {type === "bar" && (
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={sorted} margin={{ top: 24, right: 16, bottom: sorted.length > 6 ? 70 : 32, left: 16 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f8" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fontFamily: "var(--font-plex-sans)", fill: "#1a2233" }}
                    angle={sorted.length > 6 ? -30 : 0}
                    textAnchor={sorted.length > 6 ? "end" : "middle"}
                    interval={0}
                    height={sorted.length > 6 ? 70 : 32}
                    stroke="#dde3ee"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fontFamily: "var(--font-plex-mono)", fill: "#4a5568" }}
                    tickFormatter={(v) => fmt(Number(v), unit)}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    cursor={{ fill: "#f4f6fb" }}
                    contentStyle={tooltipStyle}
                    formatter={(v) => [
                      `${fmt(Number(v), unit)}${total > 0 ? ` · ${((Number(v) / total) * 100).toFixed(1)}% of total` : ""}`,
                      "",
                    ]}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(v: unknown) => fmt(Number(v), unit)}
                      style={{ fontFamily: "var(--font-plex-mono)", fontSize: 10, fill: "#1a2233" }}
                    />
                    {sorted.map((d) => (
                      <Cell key={d.label} fill={barColor(d.tone)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {type === "pie" && (
              <ResponsiveContainer width="100%" height={420}>
                <PieChart>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [
                      `${fmt(Number(v), unit)} · ${total ? ((Number(v) / total) * 100).toFixed(1) : 0}%`,
                      "",
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={10}
                    formatter={(value) => (
                      <span style={{ fontFamily: "var(--font-plex-sans)", fontSize: 12, color: "#1a2233" }}>
                        {value}
                      </span>
                    )}
                  />
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={80}
                    outerRadius={150}
                    paddingAngle={1.5}
                    label={({ label, percent }: { label?: string; percent?: number }) =>
                      percent !== undefined && percent > 0.03
                        ? `${label} · ${(percent * 100).toFixed(1)}%`
                        : ""
                    }
                    style={{ fontFamily: "var(--font-plex-mono)", fontSize: 11, fill: "#1a2233" }}
                  >
                    {data.map((d, i) => (
                      <Cell
                        key={d.label}
                        fill={d.tone ? TONE_COLOR[d.tone] : BRAND_CYCLE[i % BRAND_CYCLE.length]}
                        stroke="white"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}

            {(type === "line" || type === "area") && (
              <ResponsiveContainer width="100%" height={420}>
                {type === "line" ? (
                  <LineChart data={data} margin={{ top: 24, right: 24, bottom: 16, left: 16 }}>
                    <CartesianGrid stroke="#eef2f8" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fontFamily: "var(--font-plex-mono)", fill: "#4a5568" }}
                      stroke="#dde3ee"
                      minTickGap={18}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: "var(--font-plex-mono)", fill: "#4a5568" }}
                      tickFormatter={(v) => fmt(Number(v), unit)}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [fmt(Number(v), unit), ""]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={BRAND_PRIMARY}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    >
                      {data.length <= 20 && (
                        <LabelList
                          dataKey="value"
                          position="top"
                          formatter={(v: unknown) => fmt(Number(v), unit)}
                          style={{ fontFamily: "var(--font-plex-mono)", fontSize: 10, fill: "#1a2233" }}
                        />
                      )}
                    </Line>
                  </LineChart>
                ) : (
                  <AreaChart data={data} margin={{ top: 24, right: 24, bottom: 16, left: 16 }}>
                    <CartesianGrid stroke="#eef2f8" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fontFamily: "var(--font-plex-mono)", fill: "#4a5568" }}
                      stroke="#dde3ee"
                      minTickGap={18}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: "var(--font-plex-mono)", fill: "#4a5568" }}
                      tickFormatter={(v) => fmt(Number(v), unit)}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [fmt(Number(v), unit), ""]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={BRAND_PRIMARY}
                      strokeWidth={2.5}
                      fill={`${BRAND_PRIMARY}22`}
                      dot={{ r: 2.5 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            )}

            {type === "scatter" && (
              <ResponsiveContainer width="100%" height={420}>
                <ScatterChart margin={{ top: 16, right: 24, bottom: 40, left: 48 }}>
                  <CartesianGrid stroke="#eef2f8" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    tick={{ fontSize: 11, fontFamily: "var(--font-plex-mono)", fill: "#4a5568" }}
                    stroke="#dde3ee"
                    tickFormatter={(v) => fmt(Number(v), unit)}
                    label={
                      args.xAxisLabel
                        ? {
                            value: args.xAxisLabel,
                            position: "insideBottom",
                            offset: -24,
                            style: { fontFamily: "var(--font-plex-sans)", fontSize: 12, fill: "#1a2233" },
                          }
                        : undefined
                    }
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    tick={{ fontSize: 11, fontFamily: "var(--font-plex-mono)", fill: "#4a5568" }}
                    stroke="#dde3ee"
                    tickFormatter={(v) => fmt(Number(v), unit)}
                    label={
                      args.yAxisLabel
                        ? {
                            value: args.yAxisLabel,
                            angle: -90,
                            position: "insideLeft",
                            style: { fontFamily: "var(--font-plex-sans)", fontSize: 12, fill: "#1a2233" },
                          }
                        : undefined
                    }
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v, name) => [fmt(Number(v), unit), name]}
                    labelFormatter={(_l, payload) =>
                      (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? ""
                    }
                  />
                  <Scatter
                    data={data}
                    shape={(props: unknown) => {
                      const p = props as { cx: number; cy: number; payload: ChartArgs["data"][0] };
                      const fill = p.payload.tone ? TONE_COLOR[p.payload.tone] : "#418cc0";
                      return (
                        <g>
                          <circle cx={p.cx} cy={p.cy} r={8} fill={fill} stroke="white" strokeWidth={2} />
                          <text
                            x={p.cx + 11}
                            y={p.cy + 4}
                            fontSize={11}
                            fontFamily="var(--font-plex-sans)"
                            fill="#1a2233"
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

          {/* Underlying data */}
          <div className="border-t px-5 py-4" style={{ borderColor: "#e3e8f1" }}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[1.4px]" style={{ color: "#7f7f7f" }}>
              Underlying data
            </div>
            <table className="w-full text-[12px]" style={{ color: "#1a2233" }}>
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[1px]" style={{ color: "#7f7f7f" }}>
                  <th className="py-1 pr-4">Label</th>
                  {type === "scatter" ? (
                    <>
                      <th className="py-1 pr-4 text-right">{args.xAxisLabel ?? "X"}</th>
                      <th className="py-1 text-right">{args.yAxisLabel ?? "Y"}</th>
                    </>
                  ) : (
                    <>
                      <th className="py-1 pr-4 text-right">Value</th>
                      <th className="py-1 text-right">Share</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.label} className="border-t" style={{ borderColor: "#eef2f8" }}>
                    <td className="py-1.5 pr-4">{d.label}</td>
                    {type === "scatter" ? (
                      <>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{fmt(d.x, unit)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(d.y, unit)}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{fmt(d.value, unit)}</td>
                        <td className="py-1.5 text-right tabular-nums" style={{ color: "#4a5568" }}>
                          {total > 0 && d.value !== undefined
                            ? `${((d.value / total) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.8px]"
      style={{ borderColor: "#e3e8f1", color: "#4a5568", background: "#f4f6fb" }}
    >
      {children}
    </span>
  );
}
