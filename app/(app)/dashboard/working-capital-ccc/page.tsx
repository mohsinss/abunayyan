import { requireUser } from "@/lib/auth/session";
import { WorkingCapitalChat } from "@/components/dashboard/chat/working-capital-chat";

export const metadata = { title: "Working Capital & CCC · Interactive Brief" };

// Disable Next's static rendering so the cache-bust query string changes per
// deploy and the embedded HTML never gets served from a stale browser cache.
export const dynamic = "force-dynamic";

// Reuse the Atlas color tokens so the floating chat bubble inherits the same
// var(--atlas-*) values used by the SBU Performance Atlas chat.
const ARIAL_FONT_VARS = {
  "--font-fraunces": "Arial, Helvetica, sans-serif",
  "--font-plex-sans": "Arial, Helvetica, sans-serif",
  "--font-plex-mono": "Arial, Helvetica, sans-serif",
} as React.CSSProperties;

export default async function WorkingCapitalCccPage() {
  await requireUser();
  const v = process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString();
  return (
    <div style={ARIAL_FONT_VARS} className="atlas-scope">
      <iframe
        src={`/dashboards/working-capital-ccc.html?v=${v}`}
        title="Abunayyan Holding · Working Capital & CCC Interactive Brief"
        className="w-full border-0"
        style={{ height: "calc(100dvh - var(--app-header-h, 4rem))" }}
      />
      <WorkingCapitalChat />
    </div>
  );
}
