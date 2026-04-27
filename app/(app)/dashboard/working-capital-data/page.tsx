import { requireUser } from "@/lib/auth/session";
import {
  getWorkingCapitalGroup,
  listActiveNarrative,
  listActiveSbus,
} from "@/lib/db/queries/working-capital";
import { InteractiveBrief } from "./client/interactive-brief";
import type { SbuRow } from "./types";

export const metadata = {
  title: "Working Capital & CCC · Live Data Brief",
};
export const dynamic = "force-dynamic";

export default async function WorkingCapitalDataPage() {
  await requireUser();

  const [group, sbuRows, narrative] = await Promise.all([
    getWorkingCapitalGroup(),
    listActiveSbus(),
    listActiveNarrative(),
  ]);

  if (!group || sbuRows.length === 0) {
    return <EmptyState />;
  }

  // Strip non-serializable fields and shape for the client island.
  const sbus: SbuRow[] = sbuRows.map((s) => ({
    key: s.key,
    name: s.name,
    shareText: s.shareText ?? "",
    posture: s.posture ?? "",
    inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap,
    dio: s.dio, dso: s.dso, dpo: s.dpo,
    tInv: s.tInv, tAr: s.tAr, tCa: s.tCa, tAp: s.tAp,
    tDio: s.tDio, tDso: s.tDso, tDpo: s.tDpo,
    notes: s.notes,
  }));

  return (
    <InteractiveBrief
      group={{
        fiscalYear: group.fiscalYear,
        groupRevenue: group.groupRevenue,
        nwcTargetRelease: group.nwcTargetRelease,
        notes: group.notes ?? null,
      }}
      sbus={sbus}
      narrative={narrative.map((n) => ({
        slot: n.slot,
        title: n.title ?? "",
        body: n.body,
      }))}
    />
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="mb-3 text-2xl font-semibold">Working Capital data not seeded yet</h1>
      <p className="text-sm text-muted-foreground">
        Run <code className="rounded bg-muted px-1.5 py-0.5">pnpm db:seed:wc</code> to populate the
        wc_groups / wc_sbus / wc_narrative tables, then refresh.
      </p>
    </div>
  );
}
