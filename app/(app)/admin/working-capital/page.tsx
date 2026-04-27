import Link from "next/link";
import {
  getWorkingCapitalGroup,
  listActiveNarrative,
  listActiveSbus,
} from "@/lib/db/queries/working-capital";
import { GroupForm } from "./group-form";
import { NarrativeRow } from "./narrative-row";

export const metadata = { title: "Admin · Working Capital data" };
export const dynamic = "force-dynamic";

export default async function AdminWorkingCapitalPage() {
  const [group, sbus, narrative] = await Promise.all([
    getWorkingCapitalGroup(),
    listActiveSbus(),
    listActiveNarrative(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Working Capital data</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Source of truth for the live brief at{" "}
          <Link href="/dashboard/working-capital-data" className="underline">
            /dashboard/working-capital-data
          </Link>{" "}
          and the chatbot&apos;s vector knowledge base. Changes here flow to both on the next retrain.
        </p>
        {!group && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Tables are empty. Run <code className="rounded bg-amber-100 px-1">pnpm db:seed:wc</code> to seed.
          </div>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold">Group baseline</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Singleton row. Group revenue is the denominator for NWC / Revenue and the share-of-revenue
          chips on the dashboard.
        </p>
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
          <GroupForm
            initial={
              group
                ? {
                    fiscalYear: group.fiscalYear,
                    groupRevenue: group.groupRevenue,
                    nwcTargetRelease: group.nwcTargetRelease,
                    notes: group.notes ?? "",
                  }
                : { fiscalYear: "FY-2025", groupRevenue: 3868, nwcTargetRelease: 540, notes: "" }
            }
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">SBUs</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {sbus.length} active SBU{sbus.length === 1 ? "" : "s"}. Edit a row to change baseline /
          target balance-sheet figures, day-counts, or observation bullets.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600">
              <tr>
                <th className="px-4 py-2 text-left">Key</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Share</th>
                <th className="px-4 py-2 text-right">DIO / DSO / DPO</th>
                <th className="px-4 py-2 text-right">NWC components</th>
                <th className="px-4 py-2 text-right">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sbus.map((s) => (
                <tr key={s.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-mono text-xs">{s.key}</td>
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-neutral-600">{s.shareText ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {Math.round(s.dio)} / {Math.round(s.dso)} / {Math.round(s.dpo)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-600">
                    {Math.round(s.inv)} / {Math.round(s.ar)} / {Math.round(s.ca)} / {Math.round(s.ap)}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-neutral-500">
                    {s.updatedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/working-capital/${s.id}`}
                      className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium hover:bg-neutral-50"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Narrative</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Long-form prose chunks the chatbot retrieves and the dashboard&apos;s strategic readout
          renders. Slots are frozen — edit prose only.
        </p>
        <div className="mt-4 space-y-3">
          {narrative.map((n) => (
            <NarrativeRow
              key={n.id}
              id={n.id}
              slot={n.slot}
              title={n.title ?? ""}
              body={n.body}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
