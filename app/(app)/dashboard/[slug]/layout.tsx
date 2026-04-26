// Generated card pages used to load Fraunces / IBM Plex Sans+Mono via
// next/font. Per request, all typography is now Arial. The CSS variables
// (--font-fraunces, --font-plex-sans, --font-plex-mono) are still set so
// the chart-component code that references them via fontFamily still resolves.
const ARIAL_FONT_VARS = {
  "--font-fraunces": "Arial, Helvetica, sans-serif",
  "--font-plex-sans": "Arial, Helvetica, sans-serif",
  "--font-plex-mono": "Arial, Helvetica, sans-serif",
} as React.CSSProperties;

export default function GeneratedCardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={ARIAL_FONT_VARS}
      className="atlas-scope atlas-scroll min-h-[calc(100dvh-4rem)] font-sans text-atlas-ink"
    >
      {children}
    </div>
  );
}
