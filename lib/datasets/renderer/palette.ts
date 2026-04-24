// Atlas-themed Recharts palette. Hex literals (not CSS vars) because some
// Recharts internals stringify color props before SVG renders, where
// var(--…) doesn't resolve. Values mirror the atlas tokens in
// app/globals.css; if you change one there, change it here.

export const ATLAS_COLORS = [
  "#8B6F2E", // accent / gold
  "#b86f1d", // warn / orange
  "#a33828", // alert / red
  "#4a6b35", // ok / green
  "#4a4a48", // ink-2 / dark gray
  "#b8923f", // accent-2 / lighter gold
  "#6d8c52", // ok-2
  "#8a8780", // ink-3
];

export const ATLAS_AXIS = {
  tick: {
    fontSize: 11,
    fill: "#8a8780",
    fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
  },
  axisLine: { stroke: "#e4e1d5" },
  tickLine: { stroke: "#e4e1d5" },
};

export const ATLAS_GRID = {
  stroke: "#e4e1d5",
  strokeDasharray: "3 3",
};

export const ATLAS_TOOLTIP = {
  contentStyle: {
    background: "#ffffff",
    border: "1px solid #d4d0c2",
    borderRadius: 2,
    fontFamily: "var(--font-plex-sans), system-ui, sans-serif",
    fontSize: 12,
  },
  labelStyle: {
    color: "#8a8780",
    fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "1.2px",
  },
};

export const ATLAS_LEGEND = {
  iconType: "square" as const,
  wrapperStyle: {
    fontSize: 11,
    fontFamily: "var(--font-plex-sans), system-ui, sans-serif",
    color: "#4a4a48",
  },
};
