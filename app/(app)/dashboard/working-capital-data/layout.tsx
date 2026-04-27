import { WorkingCapitalChat } from "@/components/dashboard/chat/working-capital-chat";

// Reuse the Atlas color tokens so the floating chat bubble inherits the
// same var(--atlas-*) values used by the SBU Performance Atlas chat.
const ARIAL_FONT_VARS = {
  "--font-fraunces": "Arial, Helvetica, sans-serif",
  "--font-plex-sans": "Arial, Helvetica, sans-serif",
  "--font-plex-mono": "Arial, Helvetica, sans-serif",
} as React.CSSProperties;

export default function WorkingCapitalDataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={ARIAL_FONT_VARS} className="atlas-scope">
      {children}
      <WorkingCapitalChat />
    </div>
  );
}
