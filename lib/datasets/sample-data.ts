import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, datasetFiles, datasetRows, documents } from "@/db";

export type FileSample = {
  fileId: string;
  filename: string;
  mimeType: string;
  kind: "tabular" | "text" | "unknown";
  sheets?: Array<{
    sheet: string;
    columns: string[];
    rowCount: number;
    sampleRows: Record<string, unknown>[];
  }>;
  textSample?: string;
};

const SAMPLE_ROWS_PER_SHEET = 5;
const TEXT_SAMPLE_CHARS = 2000;

const TABULAR_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);
const TEXT_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Collects everything the proposer needs to suggest columns + views for a
// dataset, WITHOUT dumping full row contents. Per §5.2 / §6.1 of the plan:
// only headers, row counts, 5-row samples, and the first ~2k chars of text
// files. The LLM reasons about structure, not raw content.
export async function gatherFileSamples(datasetId: string): Promise<FileSample[]> {
  const files = await db
    .select()
    .from(datasetFiles)
    .where(eq(datasetFiles.datasetId, datasetId))
    .orderBy(asc(datasetFiles.createdAt));

  const out: FileSample[] = [];
  for (const f of files) {
    if (f.status !== "ready") continue;
    const kind = TABULAR_MIMES.has(f.mimeType)
      ? "tabular"
      : TEXT_MIMES.has(f.mimeType)
        ? "text"
        : extKind(f.filename);
    if (kind === "tabular") {
      const rows = await db
        .select({ sheet: datasetRows.sheet, rowIndex: datasetRows.rowIndex, data: datasetRows.data })
        .from(datasetRows)
        .where(eq(datasetRows.fileId, f.id))
        .orderBy(asc(datasetRows.sheet), asc(datasetRows.rowIndex));
      const bySheet = new Map<string, typeof rows>();
      for (const r of rows) {
        const key = r.sheet ?? "";
        const arr = bySheet.get(key) ?? [];
        arr.push(r);
        bySheet.set(key, arr);
      }
      const sheets = Array.from(bySheet.entries()).map(([sheet, sheetRows]) => ({
        sheet,
        columns: sheetRows[0] ? Object.keys(sheetRows[0].data) : [],
        rowCount: sheetRows.length,
        sampleRows: sheetRows.slice(0, SAMPLE_ROWS_PER_SHEET).map((r) => r.data),
      }));
      out.push({ fileId: f.id, filename: f.filename, mimeType: f.mimeType, kind, sheets });
    } else if (kind === "text") {
      const chunks = await db
        .select({ content: documents.content })
        .from(documents)
        .where(eq(documents.datasetId, datasetId))
        .limit(3);
      const combined = chunks
        .map((c) => c.content)
        .join("\n\n")
        .slice(0, TEXT_SAMPLE_CHARS);
      out.push({
        fileId: f.id,
        filename: f.filename,
        mimeType: f.mimeType,
        kind,
        textSample: combined,
      });
    } else {
      out.push({ fileId: f.id, filename: f.filename, mimeType: f.mimeType, kind: "unknown" });
    }
  }
  return out;
}

function extKind(filename: string): FileSample["kind"] {
  const dot = filename.lastIndexOf(".");
  const ext = dot < 0 ? "" : filename.slice(dot).toLowerCase();
  if ([".xlsx", ".xls", ".csv"].includes(ext)) return "tabular";
  if ([".docx", ".pptx"].includes(ext)) return "text";
  return "unknown";
}
