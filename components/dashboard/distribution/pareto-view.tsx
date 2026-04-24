"use client";

import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatSAR } from "@/lib/dashboard/derived";
import { useSelectedEntity } from "@/components/dashboard/selected-entity-provider";
import { colorForRank, type DistributionViewProps } from "./palette";

export function ParetoView({ data, total, onClick }: DistributionViewProps) {
  const { isActive, hoverEntity } = useSelectedEntity();
  // A Pareto plot only makes sense in descending order — the cumulative
  // line would zig-zag otherwise. Force desc regardless of outer sort.
  const sorted = [...data].sort((a, b) => b.value - a.value);
  let running = 0;
  const paretoData = sorted.map((d) => {
    running += d.value;
    return { ...d, cumPct: total > 0 ? (running / total) * 100 : 0 };
  });
  return (
    <ResponsiveContainer width="100%" height={420}>
      <ComposedChart data={paretoData} margin={{ top: 16, right: 56, bottom: 56, left: 8 }}>
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
