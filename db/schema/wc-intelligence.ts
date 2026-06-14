import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const WCX_UPLOAD_STATUSES = ["queued", "parsing", "ready", "failed"] as const;
export type WcxUploadStatus = (typeof WCX_UPLOAD_STATUSES)[number];

// One row in the QA report produced at ingest time. Reconciliation checks
// mirror the workbook's own "(calc)" cross-checks; failures don't block
// ingestion (the dummy/partial workbooks won't reconcile) — they're surfaced
// on the dashboard provenance strip and the admin page instead.
export type WcxQaCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "skip";
  failures: number;
  total: number;
  samples: Array<{
    sbu: string;
    month: string;
    expected: number;
    actual: number;
  }>;
};

export type WcxQaReport = {
  generatedAt: string;
  unknownLabels: Array<{ sheet: string; label: string }>;
  coverage: { months: string[]; sbus: string[] };
  factsCount: number;
  recordsCount: number;
  checks: WcxQaCheck[];
};

// Immutable upload versions of the Abunayyan WC Data Collection workbook.
// New uploads never overwrite earlier ones — activation is an explicit
// switch, which gives audit trail, rollback, and "what changed since the
// last upload" comparisons.
export const wcxUploads = pgTable(
  "wcx_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    filename: varchar("filename", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    status: varchar("status", { length: 16, enum: WCX_UPLOAD_STATUSES })
      .default("queued")
      .notNull(),
    parseError: text("parse_error"),
    // Inclusive month coverage, "YYYY-MM".
    periodStart: varchar("period_start", { length: 7 }),
    periodEnd: varchar("period_end", { length: 7 }),
    factsCount: integer("facts_count").default(0).notNull(),
    recordsCount: integer("records_count").default(0).notNull(),
    qaReport: jsonb("qa_report").$type<WcxQaReport>(),
    isActive: boolean("is_active").default(false).notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("wcx_uploads_status_idx").on(t.status),
    activeIdx: index("wcx_uploads_active_idx")
      .on(t.createdAt)
      .where(sql`${t.isActive} = true`),
  }),
);

export type WcxUpload = typeof wcxUploads.$inferSelect;
export type NewWcxUpload = typeof wcxUploads.$inferInsert;

// SBU dimension, scoped per upload so each version is self-contained.
// Codes come from the workbook's Sheet 1 column headers (ATC, Holystar, …).
export const wcxSbus = pgTable(
  "wcx_sbus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => wcxUploads.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 96 }).notNull(),
    pillar: varchar("pillar", { length: 64 }),
    displayOrder: smallint("display_order").default(0).notNull(),
  },
  (t) => ({
    uploadCodeIdx: uniqueIndex("wcx_sbus_upload_code_idx").on(t.uploadId, t.code),
  }),
);

export type WcxSbu = typeof wcxSbus.$inferSelect;
export type NewWcxSbu = typeof wcxSbus.$inferInsert;

// Long-format monthly facts: one row per (SBU, metric, month) cell parsed
// from the workbook's matrix sheets (2_Monthly_PL, 3_Monthly_BS_WC, 4/5
// agings, 6_Inventory_Detail, 10_Operational_Drivers, 11_Cash_Flow,
// 12_Macro_External, and the FY-26 budget block in 14_Targets_Plan).
// Group-level rows (sheet 12) use sbuCode='GROUP'. Values are stored as
// double precision — exactly the IEEE-754 doubles Excel itself uses, so a
// lookup returns the same number the cell holds.
export const wcxMonthlyFacts = pgTable(
  "wcx_monthly_facts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => wcxUploads.id, { onDelete: "cascade" }),
    sbuCode: varchar("sbu_code", { length: 32 }).notNull(),
    metricKey: varchar("metric_key", { length: 64 }).notNull(),
    // "YYYY-MM"
    month: varchar("month", { length: 7 }).notNull(),
    value: doublePrecision("value").notNull(),
  },
  (t) => ({
    cellIdx: uniqueIndex("wcx_facts_cell_idx").on(
      t.uploadId,
      t.sbuCode,
      t.metricKey,
      t.month,
    ),
    metricIdx: index("wcx_facts_metric_idx").on(t.uploadId, t.metricKey),
    monthIdx: index("wcx_facts_month_idx").on(t.uploadId, t.month),
  }),
);

export type WcxMonthlyFact = typeof wcxMonthlyFacts.$inferSelect;
export type NewWcxMonthlyFact = typeof wcxMonthlyFacts.$inferInsert;

// Record tables (sheets 7 Top Customers, 8 Top Vendors, 9 Project Register,
// 13 Benchmarks, 15 Data Quality, 16 Org Structure, 17 Submission Log,
// 1 SBU Identity, and the 13-week forecast block of sheet 14). Keys inside
// `data` are the workbook's own column headers, sanitized.
export const wcxRecords = pgTable(
  "wcx_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => wcxUploads.id, { onDelete: "cascade" }),
    sbuCode: varchar("sbu_code", { length: 32 }).notNull(),
    sheet: varchar("sheet", { length: 48 }).notNull(),
    recordIndex: integer("record_index").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  },
  (t) => ({
    sheetIdx: index("wcx_records_sheet_idx").on(t.uploadId, t.sheet),
    sbuIdx: index("wcx_records_sbu_idx").on(t.uploadId, t.sbuCode),
  }),
);

export type WcxRecord = typeof wcxRecords.$inferSelect;
export type NewWcxRecord = typeof wcxRecords.$inferInsert;

// Per-SBU operational targets from sheet 14's "OPERATIONAL TARGETS" table.
// Target CCC is a calc column in the workbook — recomputed in code as
// tDio + tDso − tDpo; the cell value is kept for cross-checking only.
export const wcxTargets = pgTable(
  "wcx_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => wcxUploads.id, { onDelete: "cascade" }),
    sbuCode: varchar("sbu_code", { length: 32 }).notNull(),
    targetInventory: doublePrecision("target_inventory"),
    targetAr: doublePrecision("target_ar"),
    targetContractAssets: doublePrecision("target_contract_assets"),
    targetAp: doublePrecision("target_ap"),
    targetDio: doublePrecision("target_dio"),
    targetDso: doublePrecision("target_dso"),
    targetDpo: doublePrecision("target_dpo"),
    targetCashReleased: doublePrecision("target_cash_released"),
    notes: text("notes"),
  },
  (t) => ({
    uploadSbuIdx: uniqueIndex("wcx_targets_upload_sbu_idx").on(t.uploadId, t.sbuCode),
  }),
);

export type WcxTarget = typeof wcxTargets.$inferSelect;
export type NewWcxTarget = typeof wcxTargets.$inferInsert;
