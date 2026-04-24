"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Slice = { name: string; value: number };

const COLORS = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#a855f7",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#22c55e",
];

export function PieView({ title, data }: { title: string; data: Slice[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
