import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Working Capital & CCC · Interactive Brief" };

// Disable Next's static rendering so the cache-bust query string changes per
// deploy and the embedded HTML never gets served from a stale browser cache.
export const dynamic = "force-dynamic";

export default async function WorkingCapitalCccPage() {
  await requireUser();
  const v = process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString();
  return (
    <iframe
      src={`/dashboards/working-capital-ccc.html?v=${v}`}
      title="Abunayyan Holding · Working Capital & CCC Interactive Brief"
      className="h-[calc(100dvh-4rem)] w-full border-0"
    />
  );
}
