import { notFound } from "next/navigation";
import { BUILTIN_CARDS } from "@/lib/datasets/builtins";

// Public share route: anyone with the URL gets full access. Maps a slug to a
// builtin's static HTML asset under /dashboards/. No auth — keep this list
// limited to dashboards that are safe to share publicly.
const PUBLIC_DASHBOARDS: Record<string, { title: string; htmlPath: string }> = {
  "working-capital-ccc": {
    title: "Working Capital & CCC — Interactive Brief",
    htmlPath: "/dashboards/working-capital-ccc.html",
  },
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dash = PUBLIC_DASHBOARDS[slug];
  const builtin = Object.values(BUILTIN_CARDS).find((c) => c.route === slug);
  return { title: dash?.title ?? builtin?.title ?? "Shared dashboard" };
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dash = PUBLIC_DASHBOARDS[slug];
  if (!dash) notFound();
  const v = process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString();
  return (
    <iframe
      src={`${dash.htmlPath}?v=${v}`}
      title={dash.title}
      className="w-full border-0"
      style={{ height: "calc(100dvh - var(--app-header-h, 4rem))" }}
    />
  );
}
