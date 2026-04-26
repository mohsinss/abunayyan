import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import config from "@/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: config.appName, template: `%s · ${config.appName}` },
  description: config.appDescription,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? `https://${config.domainName}`),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
