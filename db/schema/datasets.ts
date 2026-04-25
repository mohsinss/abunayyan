import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { chatbots } from "./chatbots";
import { users } from "./users";

export const DATASET_KINDS = ["builtin", "generated"] as const;
export type DatasetKind = (typeof DATASET_KINDS)[number];

export const DATASET_FILE_STATUSES = ["queued", "parsing", "ready", "failed"] as const;
export type DatasetFileStatus = (typeof DATASET_FILE_STATUSES)[number];

// Minimal CardConfig placeholder — full discriminated-union of View / Column
// shapes lands with phase 6 (generic renderer). See docs/datasets-cards-plan.md §7.
export type CardConfig = {
  version: 1;
  // kind='builtin' stores just { builtinKey } pointing at a registered builtin.
  builtinKey?: string;
  columns?: unknown[];
  views?: unknown[];
  // Populated by the AI proposer (phase 5); editable on the Review page.
  narrative?: string;
  chatbotSystemPrompt?: string;
  // 3–6 dataset-specific starter questions for the floating chat's empty
  // state. Populated by the proposer (Phase A of parity work). See
  // docs/datasets-cards-parity.md.
  starterPrompts?: string[];
};

export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 96 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    kind: varchar("kind", { length: 16, enum: DATASET_KINDS }).notNull(),
    config: jsonb("config").$type<CardConfig>().notNull(),
    chatbotId: uuid("chatbot_id").references(() => chatbots.id, { onDelete: "set null" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    shareEnabled: boolean("share_enabled").default(false).notNull(),
    shareToken: text("share_token").unique(),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    slugIdx: index("datasets_slug_idx").on(t.slug),
    kindIdx: index("datasets_kind_idx").on(t.kind),
    activeIdx: index("datasets_active_idx")
      .on(t.createdAt)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

export type Dataset = typeof datasets.$inferSelect;
export type NewDataset = typeof datasets.$inferInsert;

export const datasetFiles = pgTable(
  "dataset_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    status: varchar("status", { length: 16, enum: DATASET_FILE_STATUSES })
      .default("queued")
      .notNull(),
    parseError: text("parse_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    datasetIdx: index("dataset_files_dataset_idx").on(t.datasetId),
    statusIdx: index("dataset_files_status_idx").on(t.status),
  }),
);

export type DatasetFile = typeof datasetFiles.$inferSelect;
export type NewDatasetFile = typeof datasetFiles.$inferInsert;

export const datasetRows = pgTable(
  "dataset_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => datasetFiles.id, { onDelete: "cascade" }),
    sheet: varchar("sheet", { length: 128 }),
    rowIndex: integer("row_index").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  },
  (t) => ({
    datasetIdx: index("dataset_rows_dataset_idx").on(t.datasetId),
    fileIdx: index("dataset_rows_file_idx").on(t.fileId),
  }),
);

export type DatasetRow = typeof datasetRows.$inferSelect;
export type NewDatasetRow = typeof datasetRows.$inferInsert;
