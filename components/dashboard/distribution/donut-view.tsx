"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatSAR } from "@/lib/dashboard/derived";
import { useSelectedEntity } from "@/components/dashboard/selected-entity-provider";
import { colorForRank, type DistributionViewProps } from "./palette";
import { renderDonutLabel } from "./donut-label";

export function DonutView({ data, total, onClick }: DistributionViewProps) {
  const { isActive, hoverEntity } = useSelectedEntity();
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
