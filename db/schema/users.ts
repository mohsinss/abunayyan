import { boolean, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const USER_ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Schema per @auth/drizzle-adapter + Auth.js v5 expectations.
// `role` + `disabled` added to support RBAC for the admin console.
export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
    image: text("image"),
    role: varchar("role", { length: 32, enum: USER_ROLES }).default("member").notNull(),
    disabled: boolean("disabled").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
    roleIdx: index("users_role_idx").on(t.role),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
