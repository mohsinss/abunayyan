import { AtlasChat } from "@/components/dashboard/chat/atlas-chat";
import { SelectedEntityProvider } from "@/components/dashboard/selected-entity-provider";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";

// Per request, all typography is Arial. The CSS variables stay populated so
// that recharts components which reference fontFamily="var(--font-plex-mono)"
// (etc.) still resolve cleanly.
const ARIAL_FONT_VARS = {
  "--font-fraunces": "Arial, Helvetica, sans-serif",
  "--font-plex-sans": "Arial, Helvetica, sans-serif",
  "--font-plex-mono": "Arial, Helvetica, sans-serif",
} as React.CSSProperties;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={ARIAL_FONT_VARS}
      className="atlas-scope atlas-scroll font-sans text-atlas-ink"
    >
      <SelectedEntityProvider>
        <div className="flex">
          <SidebarNav />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <AtlasChat />
      </SelectedEntityProvider>
    </div>
  );
}
