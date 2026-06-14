import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

// In-process Postgres (PGlite) for real-SQL tests of the DB-bound chatbots
// modules. The production schema files are dialect-agnostic pgTable
// definitions, so they bind to PGlite unchanged; tests `vi.mock("@/db")` to
// point `db` at the instance returned here (see tests/fixtures/mock-db.ts).
//
// pglite's WASM build ships no pgvector, and only the documents table uses
// it — which none of the modules under test touch — so we downgrade the
// `vector(n)` column to text and skip its hnsw index while applying the
// otherwise-verbatim migration set.

type TestDb = PgliteDatabase<typeof schema>;

let singleton: Promise<{ db: TestDb; client: PGlite }> | null = null;

function neutralizeVector(statement: string): string | null {
  if (/using\s+hnsw/i.test(statement)) return null; // pgvector index — skip
  return statement.replace(/vector\(\d+\)/gi, "text"); // vector column → text
}

async function build() {
  const client = new PGlite();
  const dir = path.join(process.cwd(), "db/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const raw = readFileSync(path.join(dir, file), "utf8");
    for (const chunk of raw.split("--> statement-breakpoint")) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const stmt = neutralizeVector(trimmed);
      if (stmt) await client.exec(stmt);
    }
  }
  return { db: drizzle(client, { schema }), client };
}

/** Lazily build + memoize the PGlite-backed Drizzle instance for this file. */
export function getTestDb(): Promise<{ db: TestDb; client: PGlite }> {
  if (!singleton) singleton = build();
  return singleton;
}

/** Truncate every app table — call in beforeEach for per-test isolation. */
export async function resetTestDb(): Promise<void> {
  const { db } = await getTestDb();
  await db.execute(sql`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}
