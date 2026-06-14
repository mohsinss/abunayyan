import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getWcxDashboardData } from "@/lib/wcx/dashboard-data";
import { WcxBrief } from "./client/wcx-brief";

export const metadata = {
  title: "WC Intelligence · Board Brief",
};
export const dynamic = "force-dynamic";

export default async function WcIntelligencePage() {
  await requireUser();
  const data = await getWcxDashboardData();
  if (!data) return <EmptyState />;
  return <WcxBrief data={data} />;
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="mb-3 text-2xl font-semibold">No active workbook version</h1>
      <p className="text-sm text-muted-foreground">
        Upload the Abunayyan WC Data Collection workbook at{" "}
        <Link href="/admin/wc-intelligence" className="underline">
          /admin/wc-intelligence
        </Link>{" "}
        and activate it. The dashboard and the analyst chatbot read only the active version.
      </p>
    </div>
  );
}
