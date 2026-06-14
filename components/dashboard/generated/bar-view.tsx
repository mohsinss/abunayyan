"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ATLAS_AXIS, ATLAS_COLORS, ATLAS_GRID, ATLAS_LEGEND, ATLAS_TOOLTIP } from "@/lib/datasets/renderer/palette";

type Point = { x: string | number; y: number; series?: string };

// Pivots the flat server payload to a Recharts-friendly row per x plus one
// key per series.
function pivot(points: Point[]): {
  rows: Array<Record<string, string | number>>;
  seriesKeys: string[];
} {
  const byX = new Map<string | number, Record<string, string | number>>();
  const seen = new Set<string>();
  const seriesKeys: string[] = [];
  for (const p of points) {
    const key = p.series ?? "value";
    if (!seen.has(key)) {
      seen.add(key);
      seriesKeys.push(key);
    }
    const existing = byX.get(p.x) ?? { x: p.x };
    existing[key] = p.y;
    byX.set(p.x, existing);
  }
  return { rows: Array.from(byX.values()), seriesKeys };
}

export function BarView({
  data,
  xLabel,
  yLabel,
}: {
  title: string;
  data: Point[];
  xLabel?: string;
  yLabel?: string;
}) {
  const { rows, seriesKeys } = pivot(data);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid {...ATLAS_GRID} vertical={false} />
          <XAxis
            dataKey="x"
            {...ATLAS_AXIS}
            label={
              xLabel
                ? {
                    value: xLabel,
                    position: "insideBottom",
                    offset: -5,
                    fill: "#7F7F7F",
                    fontSize: 11,
                    fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
                  }
                : undefined
            }
          />
          <YAxis
            {...ATLAS_AXIS}
            label={
              yLabel
                ? {
                    value: yLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: "#7F7F7F",
                    fontSize: 11,
                    fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
                  }
                : undefined
            }
          />
          <Tooltip {...ATLAS_TOOLTIP} cursor={{ fill: "rgba(11,51,120,0.06)" }} />
          {seriesKeys.length > 1 ? <Legend {...ATLAS_LEGEND} /> : null}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={ATLAS_COLORS[i % ATLAS_COLORS.length]} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
