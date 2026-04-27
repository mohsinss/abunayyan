import "server-only";
import {
  getWorkingCapitalGroup,
  listActiveNarrative,
  listActiveSbus,
} from "@/lib/db/queries/working-capital";
import {
  cccOf,
  groupTotalsOf,
  nwcOf,
  type SbuShape,
} from "@/lib/working-capital-data/derive";

export type WorkingCapitalChunk = { id: string; content: string };

// Builds the same { id, content }[] shape that lib/working-capital/
// knowledge.ts exports — but values are templated from the live
// wc_groups / wc_sbus / wc_narrative tables. The retrain orchestrator
// upserts these into the documents table by chunk id, so admins editing
// an SBU row → next retrain re-embeds only the affected chunks.

function fmtM(v: number): string {
  return Math.round(v).toLocaleString() + "m";
}
function fmtD(v: number): string {
  return Math.round(v).toLocaleString() + " days";
}

function shapeOf(s: {
  inv: number; ar: number; ca: number; ap: number;
  dio: number; dso: number; dpo: number;
}): SbuShape {
  return {
    inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap,
    dio: s.dio, dso: s.dso, dpo: s.dpo,
  };
}

export async function buildWorkingCapitalChunksFromTables(): Promise<
  WorkingCapitalChunk[]
> {
  const [group, sbus, narrative] = await Promise.all([
    getWorkingCapitalGroup(),
    listActiveSbus(),
    listActiveNarrative(),
  ]);

  if (!group || sbus.length === 0) return [];

  const out: WorkingCapitalChunk[] = [];

  // Group-level chunk: revenue, target release, and computed totals.
  const totals = groupTotalsOf(sbus.map(shapeOf));
  out.push({
    id: "group.kpis",
    content: `${group.fiscalYear} group baseline. Group revenue is approximately SAR ${fmtM(group.groupRevenue)} (stored baseline). Operating NWC sums to approximately SAR ${fmtM(totals.nwc)}. NWC / Revenue lands at ${(totals.nwcPctRevenue * 100).toFixed(1)}%. Group CCC is ${fmtD(totals.ccc)}. The headline operational target is SAR ${fmtM(group.nwcTargetRelease)} of cash released versus baseline.${
      group.notes ? ` ${group.notes}` : ""
    }`,
  });

  // Narrative slots straight off the wc_narrative table.
  for (const n of narrative) {
    out.push({
      id: `narrative.${n.slot}`,
      content: n.title ? `${n.title}\n\n${n.body}` : n.body,
    });
  }

  // Per-SBU summary + per-SBU story chunks. Two chunks per SBU so the
  // retrieval can answer numeric questions ("Wetico DSO?") and narrative
  // questions ("Why is Wetico stable?") with the right slice.
  for (const s of sbus) {
    const cur = shapeOf(s);
    const target: SbuShape = {
      inv: s.tInv, ar: s.tAr, ca: s.tCa, ap: s.tAp,
      dio: s.tDio, dso: s.tDso, dpo: s.tDpo,
    };
    out.push({
      id: `sbu.${s.key.toLowerCase()}.summary`,
      content: `${s.name}${s.shareText ? ` — ${s.shareText}` : ""}${s.posture ? `; positioned "${s.posture}"` : ""}. ${group.fiscalYear} baseline: Inventory SAR ${fmtM(s.inv)}, Trade Receivables SAR ${fmtM(s.ar)}, Contract Assets SAR ${fmtM(s.ca)}, Accounts Payable SAR ${fmtM(s.ap)}, with DIO ${Math.round(s.dio)} days, DSO ${Math.round(s.dso)} days, DPO ${Math.round(s.dpo)} days. Operating NWC ${fmtM(nwcOf(cur))} SAR m, CCC ${fmtD(cccOf(cur))}. 12-month operational target: Inv SAR ${fmtM(s.tInv)}, AR SAR ${fmtM(s.tAr)}, CA SAR ${fmtM(s.tCa)}, AP SAR ${fmtM(s.tAp)}, DIO ${Math.round(s.tDio)}, DSO ${Math.round(s.tDso)}, DPO ${Math.round(s.tDpo)}; target NWC ${fmtM(nwcOf(target))} SAR m, target CCC ${fmtD(cccOf(target))}.`,
    });

    if (s.notes && s.notes.length > 0) {
      out.push({
        id: `sbu.${s.key.toLowerCase()}.story`,
        content: `${s.name}'s working-capital story. ${s.notes.join(" ")}`,
      });
    }
  }

  return out;
}
