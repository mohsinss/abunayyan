import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/client";
import type { FileSample } from "./sample-data";

// The view kinds we support in phase 5. Scatter/matrix/line subtypes will
// follow with the generic renderer in phase 6 — the proposer doesn't emit
// them today because there's nothing to render.
export const VIEW_KINDS = ["kpi", "bar", "line", "pie", "table"] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

export const AGGREGATIONS = ["sum", "avg", "count", "min", "max", "none"] as const;

const ColumnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["number", "integer", "string", "date", "boolean"]),
  source: z.object({
    fileId: z.string(),
    sheet: z.string().optional(),
    column: z.string(),
  }),
  nullable: z.boolean(),
});

const KpiView = z.object({
  kind: z.literal("kpi"),
  id: z.string(),
  title: z.string(),
  columnId: z.string(),
  aggregation: z.enum(AGGREGATIONS).default("sum"),
  format: z.enum(["number", "currency", "percent"]).optional(),
});

const BarLineView = z.object({
  kind: z.enum(["bar", "line"]),
  id: z.string(),
  title: z.string(),
  xColumnId: z.string(),
  yColumnId: z.string(),
  aggregation: z.enum(AGGREGATIONS).default("sum"),
  groupByColumnId: z.string().optional(),
  topN: z.number().int().min(1).max(100).optional(),
});

const PieView = z.object({
  kind: z.literal("pie"),
  id: z.string(),
  title: z.string(),
  categoryColumnId: z.string(),
  valueColumnId: z.string(),
  aggregation: z.enum(AGGREGATIONS).default("sum"),
});

const TableView = z.object({
  kind: z.literal("table"),
  id: z.string(),
  title: z.string(),
  columnIds: z.array(z.string()).min(1),
  pageSize: z.number().int().min(5).max(200).default(25),
});

export const ViewSchema = z.discriminatedUnion("kind", [KpiView, BarLineView, PieView, TableView]);

export const CardConfigProposalSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000),
  narrative: z.string().max(800),
  chatbotSystemPrompt: z.string().max(4000),
  columns: z.array(ColumnSchema),
  views: z.array(ViewSchema).min(1),
});

export type CardConfigProposal = z.infer<typeof CardConfigProposalSchema>;
export type ProposedColumn = z.infer<typeof ColumnSchema>;
export type ProposedView = z.infer<typeof ViewSchema>;

const SYSTEM_PROMPT = `You are a data analyst proposing a dashboard "card" config for a newly uploaded dataset.

Follow these rules strictly:
- Only reference columns that actually exist in the provided files. Never invent column names.
- Column \`id\` should be a URL-safe slug (lowercase, digits, dashes).
- Prefer 3–6 views total. Always include at least one table view (kind="table") that lists the most important columns.
- If there are aggregable numbers, include one or two KPI views (kind="kpi") summarising the top-line.
- For \`bar\`/\`line\` views: x is usually a category/date column, y is a numeric column.
- For \`pie\` views: value is a numeric column, category has ≤12 distinct values.
- Titles: short (≤40 chars), descriptive.
- narrative: 2–4 sentences explaining what the dataset is about.
- chatbotSystemPrompt: instructions for a chatbot that will answer questions about this dataset via semantic search over its documents and structured queries over its rows. Include: role, tone, and a reminder to only use facts from the tools (no fabrication).`;

export async function proposeCardConfig(input: {
  title: string;
  description: string | null;
  samples: FileSample[];
}): Promise<CardConfigProposal> {
  const userPrompt = buildUserPrompt(input);
  const { object } = await generateObject({
    model: models.default,
    schema: CardConfigProposalSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.2,
  });
  return object;
}

function buildUserPrompt(input: {
  title: string;
  description: string | null;
  samples: FileSample[];
}): string {
  const parts: string[] = [];
  parts.push(`Dataset title: ${input.title}`);
  if (input.description) parts.push(`Admin description: ${input.description}`);
  parts.push("\nFiles:\n");

  for (const f of input.samples) {
    parts.push(`- ${f.filename} (${f.kind}, mime=${f.mimeType}, fileId=${f.fileId})`);
    if (f.kind === "tabular" && f.sheets) {
      for (const sheet of f.sheets) {
        parts.push(
          `  · Sheet "${sheet.sheet || "(default)"}" — ${sheet.rowCount} rows, columns: ${sheet.columns.join(", ") || "(none)"}`,
        );
        if (sheet.sampleRows.length) {
          parts.push(
            `    Sample: ${JSON.stringify(sheet.sampleRows).slice(0, 1200)}`,
          );
        }
      }
    } else if (f.kind === "text" && f.textSample) {
      parts.push(`  · Text preview (first ~2k chars): ${f.textSample}`);
    }
  }

  parts.push(
    "\nReturn a CardConfigProposal matching the provided schema. Only emit views that can actually be computed from the listed columns.",
  );
  return parts.join("\n");
}
