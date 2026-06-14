"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ATLAS_COLORS, ATLAS_LEGEND, ATLAS_TOOLTIP } from "@/lib/datasets/renderer/palette";

type Slice = { name: string; value: number };

export function PieView({ data }: { title: string; data: Slice[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            stroke="#f8f9fb"
            strokeWidth={2}
            label={{ fontSize: 11, fontFamily: "var(--font-plex-mono), ui-monospace, monospace", fill: "#595959" }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={ATLAS_COLORS[i % ATLAS_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...ATLAS_TOOLTIP} />
          <Legend {...ATLAS_LEGEND} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
