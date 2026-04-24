# Database migrations

Drizzle owns the schema. Migrations are generated from
[`db/schema/`](../schema/) and live in this folder.

## Day-to-day flow

```bash
# 1. Edit a schema file under db/schema/
# 2. Generate the migration SQL
pnpm db:generate

# 3. Apply it. This now runs `drizzle-kit migrate` AND verifies that
#    every journal entry actually landed in the DB. If drizzle-kit
#    silently no-ops (see "Known issue" below), the verify pass
#    auto-applies the missing migrations.
pnpm db:migrate
```

`pnpm db:migrate` is a chain:

```text
drizzle-kit migrate          # what drizzle thinks ran
  └─ pnpm db:verify:apply    # what actually needs to run, fixed
```

## Verify-only (CI)

```bash
pnpm db:verify
```

Exit code:

- **0** — `drizzle.__drizzle_migrations` matches every entry in
  `meta/_journal.json`. Safe to deploy.
- **1** — drift detected (missing or unknown migrations). Run
  `pnpm db:verify:apply` to fix.
- **2** — config error (missing `DATABASE_URL` or journal file).
- **3** — applying a migration failed mid-way (DDL syntax error, etc.).

`-v` / `--verbose` prints a per-migration check / cross.

CI should run `pnpm db:verify` against any database the build might
touch — it's the cheapest possible check (one `SELECT`) and catches
schema drift before a route handler does at runtime.

## Known issue: drizzle-kit silent no-op

We've hit this twice (migrations `0001` and `0002`):
[`drizzle-kit migrate`](https://orm.drizzle.team/docs/migrations) reports
"migrations applied successfully" on the neon-http driver but neither
runs the DDL nor records the migration in
`drizzle.__drizzle_migrations`. The `meta/_journal.json` advances
correctly, so `pnpm db:generate` thinks the next migration is fresh,
but the schema on disk and in the DB diverge silently.

`scripts/verify-migrations.ts` works around this: it computes the
SHA-256 of each `.sql` file (matching what drizzle-kit stores), diffs
against the `__drizzle_migrations` table, and either flags or applies
the gap. The `--apply` path is idempotent (it skips
`already exists` errors from partial prior runs and inserts the
matching hash on success).

If you have time to file an upstream bug, do — but until then `pnpm
db:migrate` self-heals.

## Manual fixes

If a migration fails halfway and you want to reapply (after fixing the
SQL):

```bash
# Inspect what's actually in the tracking table
psql "$DATABASE_URL" -c 'SELECT hash, created_at FROM drizzle.__drizzle_migrations'

# Or via node:
node --env-file=.env.local -e "
  const { neon } = require('@neondatabase/serverless');
  neon(process.env.DATABASE_URL)\`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id\`
    .then(console.log);
"

# To force-reapply, delete the row for that hash, then run apply again:
node --env-file=.env.local -e "
  const { neon } = require('@neondatabase/serverless');
  neon(process.env.DATABASE_URL)\`DELETE FROM drizzle.__drizzle_migrations WHERE hash = '<bad-hash>'\`
    .then(() => console.log('removed'));
"
pnpm db:verify:apply
```

## Multi-environment safety

`.env.local` overrides `.env` (Next.js convention). All `db:*` scripts
load both via `tsx --env-file=.env --env-file=.env.local` — Node's
`--env-file` precedence is "later wins", so `.env.local` always
beats `.env`. Watch the order if you ever copy these scripts; flipping
it points your migrations at the wrong database.

If you maintain a separate staging or prod DATABASE_URL in `.env`,
`pnpm db:migrate` will hit `.env.local` only. To apply to the other
DB, prefix:

```bash
DATABASE_URL=<prod-url> pnpm db:verify:apply
```
