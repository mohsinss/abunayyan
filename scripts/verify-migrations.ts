import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as drizzleSql } from "drizzle-orm";

/**
 * Diffs `db/migrations/meta/_journal.json` against the DB's
 * `drizzle.__drizzle_migrations` table. Catches the drizzle-kit bug
 * where `pnpm db:migrate` reports success but silently skips newly
 * generated migrations.
 *
 * Modes
 *   --check (default)  exits 1 if journal and DB differ
 *   --apply            runs missing migrations + records them
 *   --verbose          prints per-file detail
 *
 * Usage
 *   pnpm db:verify         # dry-run, CI-friendly
 *   pnpm db:verify:apply   # fix drift locally
 */

type JournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type AppliedRow = { hash: string; created_at: string | number };

const MIGRATIONS_DIR = path.join(process.cwd(), "db/migrations");
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, "meta/_journal.json");

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function readJournal(): JournalEntry[] {
  if (!fs.existsSync(JOURNAL_PATH)) {
    console.error(`No journal at ${JOURNAL_PATH}. Run pnpm db:generate first.`);
    process.exit(2);
  }
  const data = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf-8")) as {
    entries: JournalEntry[];
  };
  return data.entries;
}

function loadExpected(entries: JournalEntry[]) {
  return entries.map((e) => {
    const file = path.join(MIGRATIONS_DIR, `${e.tag}.sql`);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing SQL file for journal entry: ${file}`);
    }
    const sql = fs.readFileSync(file, "utf-8");
    return { ...e, hash: sha256(sql), sql };
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

  const DB_URL = process.env.DATABASE_URL;
  if (!DB_URL) {
    console.error("DATABASE_URL is required. Tip: run via `pnpm db:verify`.");
    process.exit(2);
  }

  const sql = neon(DB_URL);

  const entries = readJournal();
  const expected = loadExpected(entries);

  // Bootstrap drizzle's tracking table on a fresh DB so the verifier
  // works before drizzle-kit has ever run successfully.
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
  const applied = (await sql`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id
  `) as AppliedRow[];

  const appliedSet = new Set(applied.map((a) => a.hash));
  const expectedSet = new Set(expected.map((e) => e.hash));

  const missing = expected.filter((e) => !appliedSet.has(e.hash));
  const unknown = applied.filter((a) => !expectedSet.has(a.hash));

  console.log(
    `journal: ${expected.length} · applied: ${applied.length} · missing: ${missing.length} · unknown: ${unknown.length}`,
  );

  if (verbose) {
    for (const e of expected) {
      const mark = appliedSet.has(e.hash) ? "✓" : "×";
      console.log(`  ${mark} ${e.tag}  ${e.hash.slice(0, 12)}…`);
    }
    for (const u of unknown) {
      console.log(
        `  ?  (unknown applied)  ${u.hash.slice(0, 12)}…  at ${new Date(Number(u.created_at)).toISOString()}`,
      );
    }
  }

  if (unknown.length > 0) {
    console.warn(
      `\n! ${unknown.length} row(s) in drizzle.__drizzle_migrations with no matching journal entry — DB has migrations the code doesn't know about. Investigate before applying.`,
    );
  }

  if (missing.length === 0) {
    console.log("✓ all journal migrations applied");
    if (unknown.length > 0) process.exit(1); // divergent is still an error
    return;
  }

  if (!apply) {
    console.error(
      `\n✗ ${missing.length} migration(s) missing from DB: ${missing.map((m) => m.tag).join(", ")}`,
    );
    console.error("Run: pnpm db:verify:apply");
    process.exit(1);
  }

  // Apply mode
  const db = drizzle(sql);
  for (const m of missing) {
    console.log(`→ applying ${m.tag}`);
    const statements = m.sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await db.execute(drizzleSql.raw(stmt));
        applied++;
      } catch (e) {
        const msg = (e as Error).message;
        if (/already exists|duplicate_object/i.test(msg)) {
          // Idempotent: a prior partial run left some objects behind.
          skipped++;
        } else {
          console.error(`   ! failed: ${msg.slice(0, 200)}`);
          console.error(`     statement: ${stmt.slice(0, 200)}`);
          process.exit(3);
        }
      }
    }
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${m.hash}, ${m.when})
    `;
    console.log(`   ✓ ${applied} stmt(s) applied, ${skipped} skipped · recorded`);
  }

  console.log(`\n✓ applied ${missing.length} migration(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
