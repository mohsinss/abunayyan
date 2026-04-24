"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSAR } from "@/lib/dashboard/derived";
import { useSelectedEntity } from "@/components/dashboard/selected-entity-provider";
import { colorForRank, type DistributionViewProps } from "./palette";

export function BarView({ data, onClick }: DistributionViewProps) {
  const { isActive, hoverEntity } = useSelectedEntity();
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
