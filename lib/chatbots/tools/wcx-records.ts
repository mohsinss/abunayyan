import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { getRecords } from "@/lib/db/queries/wc-intelligence";
import { provenanceOf, resolveSbu } from "@/lib/wcx/engine";
import type { ToolDefinition } from "./types";
import { isToolError, requireWcxContext } from "./wcx-shared";

// Friendly sheet keys → stored sheet names in wcx_records.
const SHEETS = {
  customers: "7_Top_Customers",
  vendors: "8_Top_Vendors",
  projects: "9_Project_Register",
  benchmarks: "13_Benchmarks",
  cash_forecast: "14_Cash_Forecast",
  data_quality: "15_Data_Quality",
  org_structure: "16_Org_Structure",
  submission_log: "17_Submission_Log",
  identity: "1_SBU_Identity",
} as const;
type SheetKey = keyof typeof SHEETS;

const MAX_LIMIT = 40;
const MAX_STRING = 120;

const description =
  "Read the workbook's record tables from the active upload: customers (top-20 per SBU, " +
  "concentration & payment behavior), vendors (spend, criticality, terms), projects (EPC " +
  "register: contract value, % complete, billed/collected, retention, variation orders), " +
  "benchmarks (listed-peer DSO/DIO/DPO/CCC), cash_forecast (13-week per SBU), data_quality, " +
  "org_structure, submission_log, identity. Use `fields` to project only the columns you need " +
  "(substring match) and `sortBy` to rank — e.g. top customers by 'FY-25 Revenue'. Numbers are " +
  "exact workbook values.";

function clip(v: unknown): unknown {
  if (typeof v === "string" && v.length > MAX_STRING) return v.slice(0, MAX_STRING - 1) + "…";
  return v;
}

export const wcxRecords: ToolDefinition = {
  id: "wcxRecords",
  description,
  costClass: "free",
  builder: () =>
    tool({
      description,
      parameters: z.object({
        sheet: z.enum(Object.keys(SHEETS) as [SheetKey, ...SheetKey[]]),
        sbu: z.string().max(48).optional()
          .describe("SBU code/name. Omit for all SBUs (records stay tagged per SBU)."),
        fields: z.array(z.string().max(64)).max(16).optional()
          .describe("Project only columns whose header contains any of these substrings (case-insensitive)."),
        sortBy: z.string().max(64).optional()
          .describe("Sort by the first column whose header contains this substring. Numeric-aware."),
        sortDir: z.enum(["desc", "asc"]).default("desc"),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(15),
      }),
      execute: async ({ sheet, sbu, fields, sortBy, sortDir, limit }) => {
        const ctx = await requireWcxContext();
        if (isToolError(ctx)) return ctx;

        let sbuCode: string | undefined;
        if (sbu && sbu.trim()) {
          const { code, alternatives } = resolveSbu(ctx.sbus, sbu);
          if (!code || code === "__GROUP__") {
            if (code !== "__GROUP__") {
              return {
                error: "UNKNOWN_SBU",
                message:
                  alternatives.length > 0
                    ? `'${sbu}' is ambiguous. Candidates: ${alternatives.join(", ")}`
                    : `No SBU matches '${sbu}'. Valid: ${ctx.sbus.map((s) => s.code).join(", ")}.`,
              };
            }
          } else {
            sbuCode = code;
          }
        }

        const rows = await getRecords(ctx.upload.id, SHEETS[sheet], sbuCode);
        if (rows.length === 0) {
          return {
            error: "NO_DATA",
            message: `No ${sheet} records${sbuCode ? ` for ${sbuCode}` : ""} in the active upload.`,
          };
        }

        // Discover the column universe from a sample of rows.
        const allKeys: string[] = [];
        const seen = new Set<string>();
        for (const r of rows.slice(0, 30)) {
          for (const k of Object.keys(r.data)) {
            if (!seen.has(k)) {
              seen.add(k);
              allKeys.push(k);
            }
          }
        }

        const wanted = (fields ?? []).map((f) => f.toLowerCase()).filter(Boolean);
        const projected =
          wanted.length > 0
            ? allKeys.filter((k) => wanted.some((w) => k.toLowerCase().includes(w)))
            : allKeys;

        const sortKey = sortBy
          ? allKeys.find((k) => k.toLowerCase().includes(sortBy.toLowerCase()))
          : undefined;

        let out = rows.map((r) => {
          const data: Record<string, unknown> = {};
          for (const k of projected) {
            if (r.data[k] !== undefined) data[k] = clip(r.data[k]);
          }
          return { sbu: r.sbuCode, ...data, __sortVal: sortKey ? r.data[sortKey] : undefined };
        });

        if (sortKey) {
          out = out.sort((a, b) => {
            const av = a.__sortVal;
            const bv = b.__sortVal;
            const an = typeof av === "number" ? av : Number(av);
            const bn = typeof bv === "number" ? bv : Number(bv);
            const cmp =
              Number.isFinite(an) && Number.isFinite(bn)
                ? an - bn
                : String(av ?? "").localeCompare(String(bv ?? ""));
            return sortDir === "desc" ? -cmp : cmp;
          });
        }

        const records = out.slice(0, limit).map(({ __sortVal: _ignored, ...rest }) => rest);

        return {
          sheet: SHEETS[sheet],
          sbu: sbuCode ?? "all",
          totalRecords: rows.length,
          returned: records.length,
          ...(sortKey ? { sortedBy: `${sortKey} (${sortDir})` } : {}),
          availableFields: allKeys,
          records,
          provenance: provenanceOf(ctx.upload, null),
        };
      },
    }),
};
