# 02 — Database (Postgres + Drizzle + pgvector)

**Phase:** 1 · **Depends on:** 01 · **P0**

Ditches Mongo/Mongoose in favor of Postgres + Drizzle + pgvector. Gives us typed SQL, AI-native vector search (for RAG), and free-tier serverless hosting via Neon.

## Goal

- Connect to a serverless Postgres (Neon) with pooled + unpooled URLs.
- Typed schema via Drizzle.
- `pgvector` enabled for embeddings.
- Migrations via `drizzle-kit`.
- A seed script for local dev.

## Stack

- **[Neon](https://neon.tech)** — serverless Postgres, free tier, `pgvector` native, branchable.
- **[Drizzle ORM](https://orm.drizzle.team)** — typed SQL, zero runtime overhead.
- **[Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)** — migrations.
- **`pgvector`** — embeddings.

### Alternatives (don't switch without reason)

- **Supabase** if you need Postgres + Auth + Storage in one dashboard. We're using Clerk for auth, so Neon is cleaner.
- **Planetscale (MySQL)** — no pgvector. Skip.

## Steps

### 1. Provision Neon

1. Sign up at https://neon.tech, create a project.
2. Copy the pooled connection string → `DATABASE_URL`.
3. Copy the direct (unpooled) string → `DATABASE_URL_UNPOOLED` (used by drizzle-kit for migrations).
4. Enable pgvector: in the Neon SQL editor:
   ```sql
   create extension if not exists vector;
   ```

### 2. Install

```bash
pnpm add drizzle-orm @neondatabase/serverless postgres
pnpm add -D drizzle-kit @types/pg
pnpm remove mongoose mongodb @auth/mongodb-adapter
```

### 3. Drizzle config

Create `drizzle.config.ts` at the repo root:

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import "./lib/env";
import { env } from "@/lib/env";

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
```

### 4. Drizzle client

Create `db/index.ts`:

```ts
// db/index.ts
import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";
import * as schema from "./schema";

const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema, logger: env.NODE_ENV === "development" });
export * from "./schema";
```

For edge runtimes use the `neon-http` driver (as above). For long-running Node servers (e.g. background workers), use `postgres-js` with a pool.

### 5. Schemas

Create one file per table in `db/schema/`, then barrel-export.

#### `db/schema/users.ts`

```ts
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

#### `db/schema/subscriptions.ts`

```ts
import { pgTable, timestamp, uuid, varchar, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).unique(),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  status: varchar("status", { length: 32 }).notNull(), // active, canceled, past_due, …
  hasAccess: boolean("has_access").default(false).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
```

#### `db/schema/documents.ts` (pgvector example — RAG-ready)

```ts
import { pgTable, text, timestamp, uuid, vector, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    // Claude text-embedding-3-small / OpenAI ada-002 = 1536 dims.
    // Voyage / others vary — adjust accordingly.
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    embeddingIdx: index("documents_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  }),
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
```

#### `db/schema/projects.ts`

Port the old `Project` Mongoose model to Drizzle:

```ts
import { pgTable, text, timestamp, uuid, varchar, integer, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const projectStatus = ["draft", "in_review", "approved", "rejected"] as const;

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  budget: integer("budget"),
  timeline: varchar("timeline", { length: 64 }),
  status: varchar("status", { length: 32, enum: projectStatus }).default("draft").notNull(),
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
```

#### `db/schema/index.ts`

```ts
export * from "./users";
export * from "./subscriptions";
export * from "./projects";
export * from "./documents";
```

### 6. Query helpers

Create typed queries in `lib/db/queries/` — never inline Drizzle queries in route handlers beyond trivial reads.

```ts
// lib/db/queries/users.ts
import "server-only";
import { eq } from "drizzle-orm";
import { db, users, type NewUser } from "@/db";

export async function getUserByClerkId(clerkId: string) {
  const rows = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertUserFromClerk(input: NewUser) {
  const [row] = await db
    .insert(users)
    .values(input)
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: input.email,
        name: input.name,
        imageUrl: input.imageUrl,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function deleteUserByClerkId(clerkId: string) {
  await db.delete(users).where(eq(users.clerkId, clerkId));
}
```

### 7. Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx db/seed.ts"
  }
}
```

Install `tsx` for running TS scripts: `pnpm add -D tsx`.

### 8. First migration

```bash
pnpm db:generate   # generates SQL in db/migrations/
pnpm db:migrate    # applies to DATABASE_URL
```

**Important:** before the first migration, manually run in the Neon SQL console:

```sql
create extension if not exists vector;
```

Or wrap it in a bootstrap migration file `db/migrations/0000_enable_pgvector.sql` that drizzle-kit runs before generated ones.

### 9. Seed script

```ts
// db/seed.ts
import "dotenv/config";
import { db, users } from "./index";

async function main() {
  await db.insert(users).values({
    clerkId: "user_seed_dev",
    email: "dev@example.com",
    name: "Dev Seed",
  }).onConflictDoNothing();
  console.log("Seeded.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

### 10. Delete Mongo artifacts

```bash
rm -rf models/ lib/db/mongo.ts lib/db/mongoose.ts
rm -rf lib/repositories/   # legacy Mongoose repos — Drizzle queries replace these
```

Grep for any remaining imports and fix:

```bash
rg "from [\"'](mongoose|@auth/mongodb-adapter|@/models/|@/lib/repositories/)" --type ts --type tsx
```

## RAG primer (for AI apps)

The `documents` table above is ready for RAG:

1. Embed with `@ai-sdk/openai` (`text-embedding-3-small`) or Anthropic via Voyage.
2. Insert into `documents` with the 1536-dim vector.
3. Query with cosine similarity:
   ```ts
   import { sql } from "drizzle-orm";
   const rows = await db.select({
     id: documents.id,
     content: documents.content,
     distance: sql<number>`${documents.embedding} <=> ${queryEmbedding}`,
   })
   .from(documents)
   .orderBy(sql`${documents.embedding} <=> ${queryEmbedding}`)
   .limit(8);
   ```

## Verification checklist

- [ ] `pnpm db:generate` produces a migration in `db/migrations/`.
- [ ] `pnpm db:migrate` succeeds against Neon.
- [ ] `pnpm db:studio` opens Drizzle Studio and shows `users`, `subscriptions`, `projects`, `documents`.
- [ ] `select * from pg_extension where extname = 'vector';` returns one row.
- [ ] A typed query (`db.select().from(users)`) autocompletes columns in your editor.
- [ ] `rg "mongoose|from [\"']@/models"` returns zero results.
- [ ] `pnpm db:seed` inserts a row without error.

## Gotchas

- **Neon cold starts.** First query of the day takes ~500 ms. Acceptable for SaaS; not acceptable for user-facing critical paths. Use Neon's "keep alive" or switch to a paid plan for low-latency.
- **Serverless driver vs postgres-js.** `@neondatabase/serverless` uses HTTP (fine for Next.js route handlers). For long-running scripts or queue workers, `postgres-js` is faster.
- **pgvector dimensions must match the embedding model.** Changing models = re-embed everything.
- **Always run `db:push` against dev only.** Against prod, use `db:generate` + `db:migrate` so you have an auditable migration history.
