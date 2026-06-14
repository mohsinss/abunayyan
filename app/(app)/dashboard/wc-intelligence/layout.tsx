import { WcxChat } from "@/components/dashboard/chat/wcx-chat";

// Same font/scope treatment as the working-capital brief so the floating
// chat bubble inherits the atlas color variables.
const ARIAL_FONT_VARS = {
  "--font-fraunces": "Arial, Helvetica, sans-serif",
  "--font-plex-sans": "Arial, Helvetica, sans-serif",
  "--font-plex-mono": "Arial, Helvetica, sans-serif",
} as React.CSSProperties;

export default function WcIntelligenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={ARIAL_FONT_VARS} className="atlas-scope">
      {children}
      <WcxChat />
    </div>
  );
}
