import {
  index,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// Singleton row keyed by id=1. Holds group-level baselines that aren't
// derivable from wc_sbus (revenue denominator + the headline target the
// hero progress bar tracks).
export const wcGroups = pgTable("wc_groups", {
  id: smallint("id").primaryKey(),
  fiscalYear: varchar("fiscal_year", { length: 16 }).default("FY-2025").notNull(),
  groupRevenue: real("group_revenue").notNull(),
  nwcTargetRelease: real("nwc_target_release").default(540).notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export type WcGroup = typeof wcGroups.$inferSelect;
export type NewWcGroup = typeof wcGroups.$inferInsert;

// One row per SBU. `key` is stable, used as the slider/chart DOM key.
// Targets (t_*) are the 12-month operational sweet-spots the brief
// references. archived_at hides the row from the dashboard without
// deleting history.
export const wcSbus = pgTable(
  "wc_sbus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 16 }).notNull().unique(),
    name: varchar("name", { length: 64 }).notNull(),
    shareText: varchar("share_text", { length: 64 }),
    posture: varchar("posture", { length: 160 }),
    displayOrder: smallint("display_order").notNull().default(0),

    inv: real("inv").notNull().default(0),
    ar: real("ar").notNull().default(0),
    ca: real("ca").notNull().default(0),
    ap: real("ap").notNull().default(0),
    dio: real("dio").notNull().default(0),
    dso: real("dso").notNull().default(0),
    dpo: real("dpo").notNull().default(0),

    tInv: real("t_inv").notNull().default(0),
    tAr: real("t_ar").notNull().default(0),
    tCa: real("t_ca").notNull().default(0),
    tAp: real("t_ap").notNull().default(0),
    tDio: real("t_dio").notNull().default(0),
    tDso: real("t_dso").notNull().default(0),
    tDpo: real("t_dpo").notNull().default(0),

    notes: jsonb("notes").$type<string[]>().default([]).notNull(),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    orderIdx: index("wc_sbus_display_order_idx").on(t.displayOrder),
    activeIdx: index("wc_sbus_archived_idx").on(t.archivedAt),
  }),
);

export type WcSbu = typeof wcSbus.$inferSelect;
export type NewWcSbu = typeof wcSbus.$inferInsert;

// Long-form prose addressed by stable `slot` keys ("hero.intro",
// "definitions.metrics", "summary.themes"). The retrain orchestrator
// reads these for narrative chunks; the dashboard renders them in the
// hero/footer/strategic-readout zones.
export const wcNarrative = pgTable(
  "wc_narrative",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slot: varchar("slot", { length: 64 }).notNull().unique(),
    title: varchar("title", { length: 160 }),
    body: text("body").notNull(),
    displayOrder: smallint("display_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    orderIdx: index("wc_narrative_display_order_idx").on(t.displayOrder),
  }),
);

export type WcNarrative = typeof wcNarrative.$inferSelect;
export type NewWcNarrative = typeof wcNarrative.$inferInsert;
