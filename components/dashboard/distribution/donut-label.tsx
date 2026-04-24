"use client";

// Outside-label renderer for the donut view. Places entity name +
// percent share at the end of a short leader line so every slice is
// readable even when they're thin (small SBUs in the long tail).

export function renderDonutLabel(props: unknown) {
  const p = props as {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    name?: string;
    payload?: { share?: number };
  };
  const share = p.payload?.share ?? 0;
  if (share < 0.01) return null;
  const RAD = Math.PI / 180;
  const sin = Math.sin(-p.midAngle * RAD);
  const cos = Math.cos(-p.midAngle * RAD);
  const elbow = { x: p.cx + (p.outerRadius + 10) * cos, y: p.cy + (p.outerRadius + 10) * sin };
  const endX = p.cx + (p.outerRadius + 28) * cos;
  const endY = p.cy + (p.outerRadius + 28) * sin;
  const labelX = endX + (cos >= 0 ? 4 : -4);
  const anchor = cos >= 0 ? "start" : "end";
  return (
    <g style={{ pointerEvents: "none" }}>
      <polyline
        points={`${elbow.x},${elbow.y} ${endX},${endY} ${labelX},${endY}`}
        fill="none"
        stroke="var(--atlas-line-2)"
        strokeWidth={0.75}
      />
      <text
        x={labelX}
        y={endY}
        dy={3}
        textAnchor={anchor}
        fontFamily="var(--font-plex-sans)"
        fontSize={11}
        fill="var(--atlas-ink)"
      >
        <tspan fontWeight={500}>{p.name}</tspan>
        <tspan
          dx={4}
          fontFamily="var(--font-plex-mono)"
          fontSize={10}
          fill="var(--atlas-ink-3)"
        >
          {(share * 100).toFixed(1)}%
        </tspan>
      </text>
    </g>
  );
}
