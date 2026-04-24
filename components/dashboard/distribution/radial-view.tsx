"use client";

import {
  Cell,
  Legend,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatSAR } from "@/lib/dashboard/derived";
import { useSelectedEntity } from "@/components/dashboard/selected-entity-provider";
import { colorForRank, type ChartDatum, type DistributionViewProps } from "./palette";

export function RadialView({ data, onClick }: DistributionViewProps) {
  const { isActive, hoverEntity } = useSelectedEntity();
  // Concentric arcs encode share of total. Largest share maps to a full
  // ring so the remaining arcs stay visually proportional.
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
