"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { x: string | number; y: number; series?: string };

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

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7"];

export function LineView({
  title,
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
    <section className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 12 }} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -5 } : undefined} />
            <YAxis tick={{ fontSize: 12 }} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft" } : undefined} />
            <Tooltip />
            {seriesKeys.length > 1 ? <Legend /> : null}
            {seriesKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
