import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Working Capital & CCC · Interactive Brief" };

export default async function WorkingCapitalCccPage() {
  await requireUser();
  return (
    <iframe
      src="/dashboards/working-capital-ccc.html"
      title="Abunayyan Holding · Working Capital & CCC Interactive Brief"
      className="h-[calc(100dvh-4rem)] w-full border-0"
    />
  );
}
