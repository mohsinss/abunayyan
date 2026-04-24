// Diverging HSL palette for the Distribution section.
// Semantically inverted from the cost-matrix palette: high value
// (position=0 in the sorted list) = GREEN (healthy), low = RED (thin).
// Input `t` is the position in the sorted list normalised to [0, 1].

export function distributionColor(t: number): string {
  const k = Math.max(0, Math.min(1, t));
  let h: number;
  let s: number;
  let l: number;
  if (k <= 0.5) {
    const a = k * 2; // 0 → green to yellow
    h = 110 - a * 60; // 110 (green) → 50 (yellow)
    s = 55 + a * 25; // 55% → 80%
    l = 48 - a * 5; // 48% → 43%
  } else {
    const a = (k - 0.5) * 2; // yellow to red
    h = 50 - a * 45; // 50 → 5
    s = 80 + a * 10; // 80% → 90%
    l = 48 - a * 10; // 48% → 38%
  }
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function colorForRank(rank: number, total: number): string {
  if (total <= 1) return distributionColor(0);
  return distributionColor(rank / (total - 1));
}

export type ChartDatum = {
  id: string;
  name: string;
  value: number;
  share: number;
  isJV: boolean;
};

export type DistributionView = "bar" | "pareto" | "donut" | "radial" | "treemap";

export type DistributionViewProps = {
  data: ChartDatum[];
  total: number;
  onClick: (_id: string) => void;
};
