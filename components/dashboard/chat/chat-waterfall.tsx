"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WaterfallArgs } from "@/lib/chatbots/tools/render-waterfall";

export type { WaterfallArgs };

const NAVY = "#0b3378";
const GOOD = "#0e8a5f";
const BAD = "#c8463a";
const TONE: Record<string, string> = {
  positive: GOOD,
  neutral: "#418cc0",
  warn: "#c98a2b",
  negative: BAD,
};

function fmt(v: number, unit?: string): string {
  const u = unit && unit.length <= 8 ? ` ${unit}` : "";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B${u}`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M${u}`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K${u}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: abs < 10 ? 1 : 0 })}${u}`;
}

type Row = {
  label: string;
  base: number; // invisible spacer
  size: number; // visible bar height
  signed: number; // value shown in label/tooltip
  fill: string;
  isTotal: boolean;
};

function buildRows(args: WaterfallArgs): Row[] {
  const rows: Row[] = [];
  const start = args.start.value;
  rows.push({
    label: args.start.label,
    base: Math.min(0, start),
    size: Math.abs(start),
    signed: start,
    fill: NAVY,
    isTotal: true,
  });
  let cum = start;
  for (const step of args.steps) {
    const next = cum + step.delta;
    rows.push({
      label: step.label,
      base: Math.min(cum, next),
      size: Math.abs(step.delta),
      signed: step.delta,
      fill: step.tone ? TONE[step.tone]! : step.delta >= 0 ? GOOD : BAD,
      isTotal: false,
    });
    cum = next;
  }
  rows.push({
    label: args.endLabel ?? "End",
    base: Math.min(0, cum),
    size: Math.abs(cum),
    signed: cum,
    fill: NAVY,
    isTotal: true,
  });
  return rows;
}

export function ChatWaterfall({ args }: { args: WaterfallArgs }) {
  const rows = buildRows(args);

  return (
    <figure className="my-3 overflow-hidden rounded-sm border border-atlas-line bg-atlas-bg-2">
      <figcaption className="border-b border-atlas-line px-3 py-2">
        <div className="font-serif text-[13px] font-medium text-atlas-ink">{args.title}</div>
        {args.description && (
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-atlas-ink-3">
            {args.description}
          </div>
        )}
      </figcaption>
      <div className="px-2 py-3">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} margin={{ top: 22, right: 8, bottom: rows.length > 6 ? 52 : 22, left: 8 }}>
            <XAxis
              dataKey="label"
              interval={0}
              angle={rows.length > 6 ? -28 : 0}
              textAnchor={rows.length > 6 ? "end" : "middle"}
              height={rows.length > 6 ? 52 : 22}
              tick={{ fontSize: 9, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
              axisLine={{ stroke: "var(--atlas-line-2)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fontFamily: "var(--font-plex-mono)", fill: "var(--atlas-ink-3)" }}
              tickFormatter={(v) => fmt(Number(v), args.unit)}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <ReferenceLine y={0} stroke="var(--atlas-line-2)" />
            <Tooltip
              cursor={{ fill: "var(--atlas-bg-3)" }}
              contentStyle={{
                border: "1px solid var(--atlas-line)",
                backgroundColor: "var(--atlas-bg-2)",
                fontFamily: "var(--font-plex-mono)",
                fontSize: 10,
                borderRadius: 2,
                padding: "6px 10px",
              }}
              formatter={(_v, _n, item) => {
                const row = item?.payload as Row | undefined;
                if (!row) return ["", ""];
                const sign = row.isTotal ? "" : row.signed >= 0 ? "+" : "";
                return [`${sign}${fmt(row.signed, args.unit)}`, ""];
              }}
            />
            {/* Invisible spacer that floats each step at its cumulative level. */}
            <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="size" stackId="wf" radius={[2, 2, 0, 0]}>
              <LabelList
                dataKey="signed"
                position="top"
                formatter={(v: unknown) => {
                  const n = Number(v);
                  return `${n >= 0 ? "" : "−"}${fmt(Math.abs(n), args.unit)}`;
                }}
                style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9, fill: "var(--atlas-ink-2)" }}
              />
              {rows.map((r, i) => (
                <Cell key={i} fill={r.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
