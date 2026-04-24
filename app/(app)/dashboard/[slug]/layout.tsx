import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// Same font stack the SBU Performance Atlas uses, scoped to generated card
// pages (/dashboard/[slug] and its children). Loading at the layout level
// means the wizard / gallery / SBU page each load their fonts once and the
// generated card pages inherit the editorial typography automatically.
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

export default function GeneratedCardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} atlas-scope atlas-scroll min-h-[calc(100dvh-4rem)] font-sans text-atlas-ink`}
    >
      {children}
    </div>
  );
}
