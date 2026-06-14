// Atlas-themed Recharts palette. Hex literals (not CSS vars) because some
// Recharts internals stringify color props before SVG renders, where
// var(--…) doesn't resolve. Values mirror the atlas tokens in
// app/globals.css; if you change one there, change it here.

export const ATLAS_COLORS = [
  "#0B3378", // accent / navy
  "#2964A9", // accent-2 / medium blue
  "#418CC0", // accent-3 / light blue
  "#595959", // ink-2 / dark gray
  "#7F7F7F", // ink-3 / medium gray
  "#b86f1d", // warn / orange
  "#a33828", // alert / red
  "#4a6b35", // ok / green
];

export const ATLAS_AXIS = {
  tick: {
    fontSize: 11,
    fill: "#7F7F7F",
    fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
  },
  axisLine: { stroke: "#dde3eb" },
  tickLine: { stroke: "#dde3eb" },
};

export const ATLAS_GRID = {
  stroke: "#dde3eb",
  strokeDasharray: "3 3",
};

export const ATLAS_TOOLTIP = {
  contentStyle: {
    background: "#ffffff",
    border: "1px solid #c8d2dd",
    borderRadius: 2,
    fontFamily: "var(--font-plex-sans), system-ui, sans-serif",
    fontSize: 12,
  },
  labelStyle: {
    color: "#7F7F7F",
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
    color: "#595959",
  },
};
