import "server-only";
import { tool } from "ai";
import { z } from "zod";
import {
  getSbuByKey,
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
import type { ToolDefinition } from "./types";

const description =
  "Read the FY-2025 Working Capital & CCC tables directly. Prefer this tool over " +
  "searchDatasetDocs when the question is about specific numbers (DPO, DSO, NWC, " +
  "targets, share of revenue, posture). scope='sbu' requires `key` (e.g. 'KSB'); " +
  "use scope='sbu-list' first if the user's wording is ambiguous.";

function shapeOf(row: {
  inv: number; ar: number; ca: number; ap: number;
  dio: number; dso: number; dpo: number;
}): SbuShape {
  return { inv: row.inv, ar: row.ar, ca: row.ca, ap: row.ap, dio: row.dio, dso: row.dso, dpo: row.dpo };
}

export const wcSnapshot: ToolDefinition = {
  id: "wcSnapshot",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        scope: z.enum(["all", "group", "sbu", "sbu-list", "narrative"]).default("all"),
        key: z.string().min(1).max(32).optional()
          .describe("SBU key (e.g. 'KSB', 'Wetico'). Required when scope='sbu'."),
      }),
      execute: async ({ scope, key }) => {
        const group = await getWorkingCapitalGroup();
        if (!group) {
          return { error: "NOT_SEEDED", message: "wc_groups is empty; ask the admin to seed it." };
        }

        if (scope === "group") {
          const sbus = await listActiveSbus();
          const totals = groupTotalsOf(sbus.map(shapeOf));
          return {
            fiscalYear: group.fiscalYear,
            groupRevenue: group.groupRevenue,
            nwcTargetRelease: group.nwcTargetRelease,
            notes: group.notes,
            totals,
          };
        }

        if (scope === "sbu") {
          if (!key) {
            return { error: "MISSING_KEY", message: "scope='sbu' requires `key` (e.g. 'KSB')." };
          }
          const row = await getSbuByKey(key);
          if (!row || row.archivedAt) {
            return {
              error: "NOT_FOUND",
              message: `No active SBU with key '${key}'. Try scope='sbu-list' to see valid keys.`,
            };
          }
          const cur = shapeOf(row);
          const target = {
            inv: row.tInv, ar: row.tAr, ca: row.tCa, ap: row.tAp,
            dio: row.tDio, dso: row.tDso, dpo: row.tDpo,
          };
          return {
            key: row.key,
            name: row.name,
            shareText: row.shareText,
            posture: row.posture,
            baseline: cur,
            target,
            notes: row.notes,
            derived: {
              nwc: nwcOf(cur),
              ccc: cccOf(cur),
              targetNwc: nwcOf(target),
              targetCcc: cccOf(target),
              nwcPctOfGroupRevenue:
                group.groupRevenue > 0 ? nwcOf(cur) / group.groupRevenue : 0,
            },
          };
        }

        if (scope === "sbu-list") {
          const sbus = await listActiveSbus();
          return {
            sbus: sbus.map((s) => {
              const c = shapeOf(s);
              return {
                key: s.key,
                name: s.name,
                shareText: s.shareText,
                posture: s.posture,
                nwc: nwcOf(c),
                ccc: cccOf(c),
              };
            }),
          };
        }

        if (scope === "narrative") {
          const narrative = await listActiveNarrative();
          return {
            narrative: narrative.map((n) => ({
              slot: n.slot,
              title: n.title,
              body: n.body,
            })),
          };
        }

        // scope === "all"
        const [sbus, narrative] = await Promise.all([
          listActiveSbus(),
          listActiveNarrative(),
        ]);
        const totals = groupTotalsOf(sbus.map(shapeOf));
        return {
          group: {
            fiscalYear: group.fiscalYear,
            groupRevenue: group.groupRevenue,
            nwcTargetRelease: group.nwcTargetRelease,
            notes: group.notes,
            totals,
          },
          sbus: sbus.map((s) => {
            const c = shapeOf(s);
            return {
              key: s.key,
              name: s.name,
              shareText: s.shareText,
              posture: s.posture,
              baseline: c,
              target: {
                inv: s.tInv, ar: s.tAr, ca: s.tCa, ap: s.tAp,
                dio: s.tDio, dso: s.tDso, dpo: s.tDpo,
              },
              notes: s.notes,
              derived: { nwc: nwcOf(c), ccc: cccOf(c) },
            };
          }),
          narrative: narrative.map((n) => ({ slot: n.slot, title: n.title, body: n.body })),
        };
      },
    }),
};
