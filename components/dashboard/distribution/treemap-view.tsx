"use client";

import { ResponsiveContainer, Treemap } from "recharts";
import { formatSAR } from "@/lib/dashboard/derived";
import { useSelectedEntity } from "@/components/dashboard/selected-entity-provider";
import { colorForRank, type DistributionViewProps } from "./palette";

export function TreemapView({ data, onClick }: DistributionViewProps) {
  const { isActive, hoverEntity } = useSelectedEntity();
  return (
    <ResponsiveContainer width="100%" height={420}>
      <Treemap
        data={data.map((d, i) => ({ ...d, fill: colorForRank(i, data.length) }))}
        dataKey="value"
        nameKey="name"
        stroke="white"
        content={(props: unknown) => {
          const p = props as {
            x: number;
            y: number;
            width: number;
            height: number;
            name?: string;
            value?: number;
            fill?: string;
            id?: string;
          };
          return (
            <g
              style={{ cursor: "pointer" }}
              onClick={() => p.id && onClick(p.id)}
              onMouseEnter={() => p.id && hoverEntity(p.id)}
              onMouseLeave={() => hoverEntity(null)}
            >
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                fill={p.fill || "var(--atlas-bg-3)"}
                stroke={p.id && isActive(p.id) ? "var(--atlas-accent)" : "white"}
                strokeWidth={p.id && isActive(p.id) ? 3 : 1}
              />
              {p.width > 60 && p.height > 30 && (
                <>
                  <text
                    x={p.x + 8}
                    y={p.y + 20}
                    fill="white"
                    fontFamily="var(--font-plex-sans)"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {p.name}
                  </text>
                  <text
                    x={p.x + 8}
                    y={p.y + 36}
                    fill="white"
                    fontFamily="var(--font-plex-mono)"
                    fontSize={10}
                  >
                    {formatSAR(p.value || 0)}
                  </text>
                </>
              )}
            </g>
          );
        }}
      />
    </ResponsiveContainer>
  );
}
