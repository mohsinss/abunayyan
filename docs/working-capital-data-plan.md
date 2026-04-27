# Working Capital Data — Build Plan

**Target:** a new dashboard at `/dashboard/working-capital-data` that mirrors the **exact** layout, charts, sliders, and interaction model of the existing `/dashboard/working-capital-ccc` brief — but reads every figure from Postgres instead of a hardcoded `SBUS` array in a static HTML file. The chatbot's vector knowledge base is regenerated from the same tables on demand, so dashboard numbers and chatbot answers can never drift apart.

This is an **additive** feature. The existing `/dashboard/working-capital-ccc` page, its iframe, the `working-capital-ccc.html` static file, and the `Working Capital Analyst` chatbot wiring **must not be modified**. Both routes coexist; users compare them side-by-side until the new one is trusted.

---

## 1. Goals & non-goals

### Goals
1. Move the FY-2025 numbers from [working-capital-ccc.html](../public/dashboards/working-capital-ccc.html) into structured Postgres tables.
2. Render `/dashboard/working-capital-data` as a real React component reading those tables — visually and behaviourally identical to the current iframe brief (sliders, charts, presets, ticker, reset button).
3. Provide a minimal admin surface to edit SBU rows and group baselines (so updates flow through the system, not through HTML edits).
4. Rewire the existing **Retrain Working Capital KB** flow to read from the tables and emit chunks dynamically — replacing the hand-curated `lib/working-capital/knowledge.ts`.

### Non-goals
- Touching `/dashboard/working-capital-ccc`, the iframe page, or `working-capital-ccc.html`. Left intact.
- Touching the `working-capital-analyst` bot row, its tools, or its system prompt — only the **source** of its embeddings changes.
- Re-doing the chat UI or the user-menu retrain button. Both keep working.
- Multi-year history, audit-of-data-edits beyond the existing `audit_log` event, role-based field-level permissions, optimistic locking on edit forms. All deferred.
- Migrating the `Working Capital Analyst` to the new corpus before parity is verified. Until cutover, retrain still reads `knowledge.ts`. The new path is opt-in via a flag.

### Hard constraints (enforced in code review)
- No edits to:
  - `app/(app)/dashboard/working-capital-ccc/page.tsx`
  - `public/dashboards/working-capital-ccc.html`
  - `components/auth/branded-header.tsx` matchers (the `BRANDED_ROUTES` regex stays scoped to `working-capital-ccc`)
- The `working_capital.retrained` audit event is reused, not renamed.

---

## 2. Architecture

```
                ┌───────────────────────────┐
                │  Postgres source of truth │
                │  ─ wc_groups              │
                │  ─ wc_sbus                │
                │  ─ wc_narrative           │
                └─────────┬─────────────────┘
                          │
          ┌───────────────┼────────────────────┐
          │                                    │
          ▼                                    ▼
 /dashboard/working-capital-data      retrain orchestrator (v2)
 (React + Chart.js — sliders,                │
  presets, ticker, reset)                    │ formats prose chunks from rows
                                             ▼
                                 OpenAI text-embedding-3-small
                                             │
                                             ▼
                                 documents (pgvector, HNSW)
                                             │
                                             ▼
                                  Working Capital Analyst chatbot
```

The dashboard is a **server component** for the initial render (rows are fetched once, hydrated into a client island for interaction). Sliders and charts are client-side and operate purely in memory after first paint — no per-keystroke server round-trips.

Sliders **never write back to Postgres**. They are exploratory levers, exactly as in the current brief. Persistence happens only via the admin edit form.

---

## 3. Data model

Three new tables, all under a `wc_` prefix to keep the `working-capital-` route's domain visible in `psql \dt`. Drizzle schema lives in [`db/schema/working-capital.ts`](../db/schema/working-capital.ts) (new file).

### `wc_groups` — group-level KPI baseline (one row, `id = 1`)

| column | type | notes |
|---|---|---|
| `id` | smallint PK | always `1`. Singleton row; admins never insert another. |
| `fiscal_year` | varchar(8) | e.g. `"FY-2025"`. Display only. |
| `group_revenue` | real | SAR millions (denominator for NWC/Revenue %). |
| `nwc_target_release` | real | hero target, default `540`. |
| `notes` | text | free-form, surfaces in brief footer. |
| `updated_at` | timestamptz | auto. |
| `updated_by` | text → users.id | nullable. |

### `wc_sbus` — one row per SBU

Mirrors every numeric field on the HTML's `SBUS` array verbatim, plus identity columns.

| column | type | notes |
|---|---|---|
| `id` | uuid PK default random | |
| `key` | varchar(16) UNIQUE NOT NULL | `"ATC"`, `"Wetico"`, etc. — used as the slider/chart DOM key. |
| `name` | varchar(64) NOT NULL | Display name. |
| `share_text` | varchar(64) | e.g. `"42% of revenue"`. Plain text — not derived. |
| `posture` | varchar(120) | strategy line shown under the SBU header. |
| `display_order` | smallint NOT NULL | controls tab + chart sort. Default by `key` alphabetically on seed; admins can reorder. |
| `inv` | real | FY-2025 baseline, SAR m. |
| `ar` | real | |
| `ca` | real | |
| `ap` | real | |
| `dio` | real | days |
| `dso` | real | days |
| `dpo` | real | days |
| `t_inv` | real | 12-month operational target. |
| `t_ar` | real | |
| `t_ca` | real | |
| `t_ap` | real | |
| `t_dio` | real | |
| `t_dso` | real | |
| `t_dpo` | real | |
| `notes` | jsonb (`text[]`-shaped) | the four observation bullets. |
| `archived_at` | timestamptz | soft delete; archived SBUs vanish from the dashboard but stay queryable. |
| `created_at` / `updated_at` / `updated_by` | — | standard. |

**Derived values** are NOT stored: `cogs_d`, `rev_d`, `nwc`, `ccc`, group sums. These are computed in `lib/working-capital-data/derive.ts` so a single function shared by the dashboard and the retrain orchestrator guarantees identical math.

### `wc_narrative` — long-form prose (hero, definitions, summaries)

Replaces the framing/summary chunks currently hardcoded in `lib/working-capital/knowledge.ts`.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `slot` | varchar(64) UNIQUE NOT NULL | semantic key — `"hero.intro"`, `"definitions.metrics"`, `"summary.themes"`, etc. The retrain orchestrator addresses chunks by slot. |
| `title` | varchar(120) | optional display heading. |
| `body` | text NOT NULL | markdown-ish prose. |
| `display_order` | smallint | for ordering on the dashboard footer / readout panels. |
| `archived_at` | timestamptz | soft delete. |
| timestamps + `updated_by` | — | standard. |

---

## 4. Migration & seeding

1. **Drizzle migration** generated via `pnpm db:generate` — new file under `drizzle/` adding the three tables. No changes to existing tables.
2. **Seed script** at `scripts/seed-working-capital.ts` parses the `SBUS` array out of the HTML at build time (a small regex-and-eval helper, *not* runtime). One-shot; rerunning is idempotent via `ON CONFLICT (key) DO NOTHING`. Group + narrative rows seeded from values currently in [knowledge.ts](../lib/working-capital/knowledge.ts).
3. **Production rollout**: run migration via the existing Drizzle pipeline, then `pnpm tsx scripts/seed-working-capital.ts` once. No drop/recreate. Safe to re-run.

---

## 5. New page structure

```
app/(app)/dashboard/working-capital-data/
  page.tsx                       # Server component — fetches rows, renders dashboard
  layout.tsx                     # Loads atlas-scope wrapper + WorkingCapitalChat (NOT a new bot)
  client/
    interactive-brief.tsx        # "use client" — owns slider/chart state
    group-dashboard.tsx          # KPI tiles + two group charts
    sbu-tabs.tsx                 # Tab strip
    sbu-card.tsx                 # Per-SBU split layout (sliders left, charts/notes right)
    slider-row.tsx               # One labeled range input with sweet-spot marker
    ticker.tsx                   # Sticky executive ticker (top of page)
    presets.tsx                  # Base / Conservative / Aggressive / Hit-All buttons
    charts/
      nwc-stack.tsx              # Group "NWC contribution by SBU" stacked bar
      ccc-bar.tsx                # Group "CCC by SBU (days)" baseline-vs-adjusted
      sbu-nwc-chart.tsx          # Per-SBU NWC composition mini-chart
      sbu-ccc-chart.tsx          # Per-SBU CCC components mini-chart
  styles.module.css              # Ports the working-capital-ccc.html CSS verbatim
```

The CSS is a **direct copy** of the `<style>` block from the HTML, scoped via CSS-modules so it can't leak into the rest of the app. Color variables, ticker animation, slider styling, sweet-spot dotted line — all preserved.

---

## 6. UI implementation strategy

### Charts: Chart.js, not Recharts
The current brief uses Chart.js. Recharts is the platform default elsewhere, but for this clone we keep **Chart.js** so visuals match pixel-for-pixel. Two reasons:
1. Slider drag → chart update relies on Chart.js's `update("none")` for sub-frame redraws. Recharts re-renders the React tree on every state change; on 10 charts × 60fps that's noticeable.
2. The dotted target lines, gradient fills, and tooltip formatting are already tuned in the HTML — porting them is hours, not days.

We add `chart.js` (already a transitive dep via the static page; promote to direct) and a thin React wrapper at `client/charts/use-chart.ts` that creates a chart on mount, calls `update` on prop change, and destroys on unmount. ~40 LOC.

### State
- Server component fetches rows once, passes serializable plain objects to the client island.
- Client island holds `sbus` and `groups` in `useState`, mirrors the HTML's `cur`/`base` per-SBU pattern.
- Slider input → updates `cur`, triggers `Chart.update`. No Context, no Zustand. Group totals are recomputed via the shared `derive.ts` helper.
- Preset buttons map a `0..1` factor across every slider — same logic as the HTML.

### Performance
First paint is server-rendered HTML with charts placeholder-rendered on hydration. Initial bundle adds Chart.js (~75kb gzipped) — acceptable given the route is auth-gated and visited intentionally.

---

## 7. Admin CRUD

Minimal to start. New page `app/(app)/admin/working-capital-data/page.tsx`:

- **Group baseline form** — one section, fields: `groupRevenue`, `nwcTargetRelease`, `fiscalYear`, `notes`. Submit → server action `updateGroup`.
- **SBU table** — list of `wc_sbus` rows. Each row links to `app/(app)/admin/working-capital-data/[id]/page.tsx` with a flat form: every numeric field on `wc_sbus` plus `notes` (one textarea per bullet, max four bullets).
- **Narrative editor** — a list of slots with title + body textarea each. Slots are seeded; admins edit prose, never add/remove slots in v1.
- **No archive UI in v1.** `archived_at` stays in schema for a future button.

Server actions live in `app/(app)/admin/working-capital-data/actions.ts`, all gated by `requireRole("admin")`, all writing an `audit_log` entry under a new event. (See §10.)

---

## 8. Retrain rewire

Today: [`lib/working-capital/retrain.ts`](../lib/working-capital/retrain.ts) reads the `WORKING_CAPITAL_CHUNKS` constant from [`lib/working-capital/knowledge.ts`](../lib/working-capital/knowledge.ts) and upserts them as `documents` rows for the dataset.

Tomorrow:
1. New helper `lib/working-capital-data/build-chunks.ts` reads `wc_groups`, `wc_sbus`, `wc_narrative` and emits the same `{ id, content }[]` shape — but with values templated from the rows. One chunk per slot for narrative; per-SBU summary + per-SBU story templated from the row's columns; group KPI chunk templated from `wc_groups`.
2. The retrain orchestrator gains a `source: "static" | "tables"` parameter. Default stays `"static"` until cutover. The `Retrain Working Capital KB` button passes the source as a query string; the API route reads platform settings to pick the default.
3. Cutover: flip the platform setting to `"tables"`. Old `knowledge.ts` is kept (untouched) as a fallback for one release, then deleted in a follow-up.

Hash-per-chunk diffing already in place keeps repeat retrains cheap. Editing one SBU row → one chunk's hash changes → one OpenAI embed call.

---

## 9. Implementation phases

### Phase 1 — schema + seed (small, safe)
1. Add `db/schema/working-capital.ts`, run `pnpm db:generate`, commit migration.
2. Write `scripts/seed-working-capital.ts`. Run locally, verify rows.
3. No UI changes yet. Existing `/working-capital-ccc` and chatbot keep working unchanged.

### Phase 2 — derive + read API
1. Add `lib/working-capital-data/derive.ts` with `nwcOf`, `cccOf`, `groupTotals`, `applyPreset` — pure functions, fully unit-tested.
2. Add `lib/db/queries/working-capital.ts` with read-only fetchers.
3. No UI changes. Just guarantees the math is correct and matches HTML output for every SBU.

### Phase 3 — dashboard UI
1. Build `app/(app)/dashboard/working-capital-data/` per §5.
2. Port the HTML's CSS into `styles.module.css`.
3. Render the same charts via the Chart.js wrapper. Add a `WorkingCapitalChat` mount (uses the existing bot — no new bot row).
4. Add a manual visual-diff session: `/working-capital-ccc` and `/working-capital-data` open side-by-side, every chart and KPI compared.

### Phase 4 — admin CRUD
1. Edit forms per §7 with server actions + audit events.
2. New audit events: `working_capital_data.group_updated`, `working_capital_data.sbu_updated`, `working_capital_data.narrative_updated`.

### Phase 5 — retrain cutover
1. Implement `build-chunks.ts`.
2. Add `source` param to retrain orchestrator, default `"static"`.
3. Smoke-test: edit one SBU's DSO in admin → retrain with `source=tables` → ask the chatbot the new figure → verify it matches.
4. Flip platform default to `"tables"`. Schedule `knowledge.ts` deletion for the next release.

Each phase is independently shippable and reversible.

---

## 10. New audit events

Append to [`db/schema/audit-log.ts`](../db/schema/audit-log.ts) `AUDIT_EVENTS`:

```
"working_capital_data.group_updated",
"working_capital_data.sbu_updated",
"working_capital_data.narrative_updated",
```

The existing `working_capital.retrained` event is reused for retraining, regardless of source.

---

## 11. Testing

- **Unit:** `derive.ts` math (NWC, CCC, group totals, preset interpolation) under `tests/unit/working-capital-data/derive.test.ts`. Golden-row test: feed every SBU's baseline values and assert the computed NWC/CCC matches the HTML's stated value (within 1 day / 1 SAR m rounding).
- **Unit:** `build-chunks.ts` formatting — given a known SBU row, assert the emitted chunk content contains the right figures and the right slot id.
- **Integration:** `tests/integration/admin-working-capital-data.test.ts` covers the three server actions: success, RBAC denial, audit row written.
- **Visual parity:** manual side-by-side review at the end of phase 3. No screenshot test — overkill for now.

---

## 12. Open questions (decide before phase 3)

1. **Cosmetic divergence allowed?** The HTML uses inline `<style>` with custom color tokens (`--brand-1: #0B3378`, etc.) — different from the Atlas palette. Do we keep that palette on `/working-capital-data` (matches the original brief, looks "different" from Atlas) or recolor to `--atlas-*` variables for consistency? Default plan: keep the original palette; brief should look like the brief.
2. **Editing concurrency.** Two admins editing the same SBU at once → last write wins, no warning. Acceptable for an internal tool with ~3 admins?
3. **Narrative slot list.** Frozen in v1 (no add/remove)? If yes, what is the canonical list — same 27 slots as today's `knowledge.ts`, plus one per-SBU summary + story slot, or do we collapse SBU narratives into the row itself?
4. **JSON-edit fallback.** Do we want a "raw JSON" textarea on the SBU edit page as an escape hatch for bulk paste, or keep the form strict?

These are all small calls; default answers are listed in line. They don't block phase 1 or 2.

---

## 13. Estimated effort

| Phase | Effort |
|---|---|
| 1. Schema + seed | 0.5 day |
| 2. Derive + queries + tests | 0.5 day |
| 3. Dashboard UI parity | 2-3 days |
| 4. Admin CRUD | 1 day |
| 5. Retrain cutover | 0.5 day |
| **Total** | **~5 days** |

Phase 3 is the bulk; the rest is mechanical. The risk concentrates in pixel-parity with the existing brief — Chart.js options, slider styling, the sticky ticker animation. Budget extra hours there, not on the data plumbing.

---

## 14. What stays untouched (recap)

- `/dashboard/working-capital-ccc` route, page, iframe — frozen.
- `public/dashboards/working-capital-ccc.html` — frozen.
- `components/auth/branded-header.tsx` `BRANDED_ROUTES` config — frozen (does not match `working-capital-data`; if we want the gradient header on the new route too, that's a one-line addition discussed in phase 3).
- `working-capital-analyst` chatbot row, system prompt, tool list — frozen.
- `lib/working-capital/knowledge.ts` — frozen until phase 5 cutover; then deleted in a follow-up commit.

The two routes coexist for as long as we want them to. Cutover happens only when you say it does.
