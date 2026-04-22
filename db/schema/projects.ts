import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const PROJECT_STATUS = ["draft", "in_review", "approved", "rejected"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  budget: integer("budget"),
  timeline: varchar("timeline", { length: 64 }),
  status: varchar("status", { length: 32, enum: PROJECT_STATUS }).default("draft").notNull(),
  analysis: jsonb("analysis").$type<{
    score: number;
    risks: string[];
    recommendations: string[];
  } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
