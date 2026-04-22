import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SelectedEntityProvider } from "@/components/dashboard/selected-entity-provider";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} atlas-scope atlas-scroll font-sans text-atlas-ink`}
    >
      <SelectedEntityProvider>
        <div className="flex">
          <SidebarNav />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </SelectedEntityProvider>
    </div>
  );
}
