import Link from "next/link";
import { listUploads } from "@/lib/db/queries/wc-intelligence";
import { UploadPanel } from "./upload-panel";
import { VersionTable } from "./version-table";

export const metadata = { title: "Admin · WC Intelligence" };
export const dynamic = "force-dynamic";

export default async function AdminWcIntelligencePage() {
  const uploads = await listUploads();
  const active = uploads.find((u) => u.isActive);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">WC Intelligence — workbook uploads</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Versioned ingestion of the Abunayyan WC Data Collection workbook. Each upload is
          parsed, validated against the metric registry, reconciled, and stored as an immutable
          version. The dashboard at{" "}
          <Link href="/dashboard/wc-intelligence" className="underline">
            /dashboard/wc-intelligence
          </Link>{" "}
          and its analyst chatbot read only the <b>active</b> version.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Upload a new version</h2>
        <p className="mt-1 text-sm text-neutral-600">
          .xlsx only, same 18-sheet template. Parsing runs in the background — refresh to see
          status. New versions are <b>not</b> activated automatically (except the very first);
          review the QA report, then activate. Activating only switches which version feeds the
          dashboard and chatbot — <b>previous versions are retained</b> and can be re-activated to
          roll back.
        </p>
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
          <UploadPanel />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Versions</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {uploads.length} upload{uploads.length === 1 ? "" : "s"}
          {active ? (
            <>
              {" "}
              · active: <b>{active.filename}</b> ({active.periodStart} → {active.periodEnd})
            </>
          ) : (
            " · no active version yet"
          )}
        </p>
        <div className="mt-4">
          <VersionTable
            uploads={uploads.map((u) => ({
              id: u.id,
              filename: u.filename,
              status: u.status,
              parseError: u.parseError,
              periodStart: u.periodStart,
              periodEnd: u.periodEnd,
              factsCount: u.factsCount,
              recordsCount: u.recordsCount,
              isActive: u.isActive,
              createdAt: u.createdAt.toISOString(),
              qa: u.qaReport
                ? {
                    unknownLabels: u.qaReport.unknownLabels.length,
                    checksPassed: u.qaReport.checks.filter((c) => c.status === "pass").length,
                    checksFailed: u.qaReport.checks.filter((c) => c.status === "fail").length,
                    checksSkipped: u.qaReport.checks.filter((c) => c.status === "skip").length,
                    failedChecks: u.qaReport.checks
                      .filter((c) => c.status === "fail")
                      .map((c) => ({ id: c.id, label: c.label, failures: c.failures, total: c.total })),
                  }
                : null,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
