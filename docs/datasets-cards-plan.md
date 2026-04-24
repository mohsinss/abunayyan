# Datasets-as-Cards — Design Plan

**Target:** turn `/dashboard` from a single hand-built SBU Performance Atlas into a gallery of **dataset cards**. Each card is a self-contained, admin-created dataset with its own chart views, its own URL, and its own chatbot backed by a scoped vector index. The existing SBU Atlas becomes the first card; new cards are created by uploading files, letting an AI propose a view config, and (after admin edits) generating the card.

This is a design doc. No code yet — we agree on the shape here, then implement.

---

## 1. Guiding principles

1. **Cards are isolated by default.** Each card owns its data, its chart config, its uploaded source files, its vector chunks, and its chatbot thread. Cross-card queries are out of scope for v1. Isolation makes permissions, deletion, and retrieval trivial to reason about.
2. **RAG, never dumping.** The chatbot for a card answers from **retrieved chunks only**. We never inline a full Excel/CSV/Word/PPTX into the prompt. All source text — extracted from every accepted file type — is chunked, embedded with `text-embedding-3-small`, and stored in pgvector. At query time the chatbot semantically searches only that card's chunks and sends the top-k to the model. This is a hard constraint; any code that bypasses it fails review.
3. **AI-first config, admin-edits.** After upload, an LLM inspects the data (column headers, sample rows, extracted document text) and **proposes** the card's config: title, description, which columns matter, which chart types fit, axes, groupings. The admin reviews the proposal on a "Generate" screen, edits anything wrong, then confirms. We never ask the admin to pick columns from a blank slate.
4. **One schema for all cards, generic renderer.** Every card — including SBU Atlas — is described by the same `CardConfig` shape. The renderer is a registry of chart components keyed by config type (`bar`, `line`, `scatter`, `pie`, `kpi`, `table`, `matrix`). Adding a new chart type is one entry in the registry.
5. **Admin-only creation, viewer-open reading.** Creating/editing/deleting a card requires the `admin` role. Viewing a card and chatting with it is open to any authenticated user (matches how `allowedRoles` already works on chatbots).
6. **Preserve the SBU Atlas as-is for v1.** The existing hand-coded dashboard stays. We register it as a **builtin card** — a card row whose `kind = 'builtin'` points at the existing `/app/(app)/dashboard/sections/*` components rather than a generic renderer. Migrating it onto the generic renderer is a v2 task; forcing it now would gate the feature on a big refactor for no user-visible win.

---

## 2. User flow

### 2.1 Gallery (`/dashboard`)

Replaces the current long-scroll dashboard. Shows a grid of cards:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ SBU Performance  │  │ Q1 Supplier      │  │ + Create new     │
│ Atlas (FY2026)   │  │ Spend Review     │  │   dataset        │
│ 14 SBUs · 7 views│  │ 3 files · 4 views│  │                  │
│ [Open] [Chat]    │  │ [Open] [Chat]    │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Each card tile shows: title, short description, source-file count, view count, last-updated timestamp, two actions (Open → full view, Chat → embedded chatbot). The "+ Create" tile is only rendered for admins.

### 2.2 Create flow (`/dashboard/new`)

Three-step wizard, one page:

1. **Describe** — title (required), short description, tags (optional).
2. **Upload** — drag-and-drop one or more files. Accepted: `.xlsx`, `.xls`, `.csv`, `.docx`, `.pptx`. Size cap and count cap enforced (see §9 open questions). Each file shows parse status: queued → parsing → ready / failed.
3. **Generate** — button disabled until all files are `ready`. Clicking triggers the AI config proposal (see §6) and navigates to the Review step.

### 2.3 Review & confirm (`/dashboard/new/review?draft=<id>`)

Shows the AI-proposed config in an editable form:

- **Card metadata** (title, description) — prefilled from §2.2 step 1 + AI refinement.
- **Views** — an ordered list of proposed charts. Each view is a collapsible panel showing: chart type, selected columns (x/y/series/filter), title, live preview rendered against the parsed data. Admin can: edit any field, re-pick columns from a dropdown of detected columns, switch chart type, reorder, delete, or "Add view" from a blank template.
- **Chatbot settings** — model, temperature, system prompt, rate limit, cost cap. All fields default to the **platform default** set in the admin panel; any field the admin changes here becomes a **per-chatbot override** (see §8). System prompt is prefilled from the AI proposer based on the dataset description.

A final **Generate card** button persists the card, its views, its chatbot row, and enqueues the indexing job (see §5.4). Admin is redirected to `/dashboard/<slug>` when the job finishes.

### 2.4 Card view (`/dashboard/<slug>`)

Same layout as today's SBU Atlas: left side-nav listing each view, main column scrolling through views in order. Two extra affordances:

- **Chat** button (top-right) opens the card's chatbot in a side panel. Threads are per-card, scoped to `datasetId`.
- **Share** button (admins only) → toggles a public share link for the card (see §11).
- **Manage** button (admins only) → `/dashboard/<slug>/edit` for editing views, re-uploading files, or deleting.

---

## 3. Routes & URLs

| Route | Purpose | Access |
|---|---|---|
| `/dashboard` | Card gallery | any authed user |
| `/dashboard/new` | Upload wizard (steps 1–2) | admin |
| `/dashboard/new/review?draft=<id>` | Review AI proposal + confirm | admin |
| `/dashboard/<slug>` | Render a card | any authed user (future: per-card role gate) |
| `/dashboard/<slug>/edit` | Edit card config & files | admin |
| `/dashboard/<slug>/chat` | Full-page chatbot for the card | any authed user |
| `/dashboard/<slug>/share` | Manage public share link (enable, rotate token) | admin |
| `/s/<token>` | Public read-only card view + embedded chatbot (no auth) | anyone with the token |
| `/api/datasets` (POST) | Create draft dataset + start parse | admin |
| `/api/datasets/<id>/propose` (POST) | Run AI config proposal | admin |
| `/api/datasets/<id>` (PATCH/DELETE) | Edit or soft-delete | admin |

Slugs are generated from the title (`slugify(title)`), disambiguated with a short suffix on collision. The SBU Atlas reserves the slug `sbu-performance-atlas`.

---

## 4. Data model

Four new tables, one new column on `documents`.

### 4.1 `datasets`

The card itself.

```ts
// db/schema/datasets.ts sketch
export const datasets = pgTable("datasets", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind", { enum: ["builtin", "generated"] }).notNull(),
  // For kind='generated', config is the CardConfig (see §7).
  // For kind='builtin', config points at a registered builtin key.
  config: jsonb("config").notNull().$type<CardConfig>(),
  chatbotId: uuid("chatbot_id").references(() => chatbots.id, { onDelete: "set null" }),
  createdBy: text("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Public share: shareEnabled=true + non-null shareToken → publicly accessible at /s/<token>.
  shareEnabled: boolean("share_enabled").notNull().default(false),
  shareToken: text("share_token").unique(),
  sharedAt: timestamp("shared_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

### 4.2 `dataset_files`

One row per uploaded source file.

```ts
export const datasetFiles = pgTable("dataset_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  datasetId: uuid("dataset_id").references(() => datasets.id, { onDelete: "cascade" }).notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(), // see §9 open question on storage
  status: text("status", { enum: ["queued", "parsing", "ready", "failed"] }).notNull(),
  parseError: text("parse_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### 4.3 `dataset_rows`

Parsed tabular rows from Excel/CSV. Stored as JSONB (one row per record) so the schema flexes per dataset. This is what the chart renderer queries.

```ts
export const datasetRows = pgTable("dataset_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  datasetId: uuid("dataset_id").references(() => datasets.id, { onDelete: "cascade" }).notNull(),
  fileId: uuid("file_id").references(() => datasetFiles.id, { onDelete: "cascade" }).notNull(),
  sheet: text("sheet"), // null for CSV
  rowIndex: integer("row_index").notNull(),
  data: jsonb("data").notNull(), // { columnName: value, ... }
}, (t) => ({
  byDataset: index("dataset_rows_dataset_idx").on(t.datasetId),
}));
```

Columns (names, inferred types, nullable) live inside `datasets.config.columns` — we don't need a separate table.

### 4.4 `documents` — add `datasetId`

The existing `documents` table stays, but we add an optional `datasetId` foreign key. When set, the chunk belongs to a card; `searchDocuments` filters on it. When null, behavior is unchanged (current per-user docs).

```ts
export const documents = pgTable("documents", {
  // ...existing columns
  datasetId: uuid("dataset_id").references(() => datasets.id, { onDelete: "cascade" }),
}, (t) => ({
  embeddingIdx: index("documents_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  byDataset: index("documents_dataset_idx").on(t.datasetId),
}));
```

We extend `searchDocumentsByEmbedding` with an optional `datasetId` arg; when passed, it adds `AND dataset_id = $1` to the where clause. The `searchDocs` tool gets a new variant (`searchDatasetDocs`) that pulls `datasetId` from its `ctx` instead of `userId`.

### 4.5 Why not separate `dataset_chunks`?

Considered, rejected. The `documents` table already has the HNSW index, embedding dims, and tooling. Adding one nullable FK reuses all of that with no duplication. The cost is a mixed-purpose table, which we manage by index + query-time filter.

---

## 5. File ingestion pipeline

Files land in **Vercel Blob** (one blob per upload; the returned key is stored in `dataset_files.storage_key`). Parsing runs as a background job per file — one job per `dataset_files` row — so the upload HTTP request returns immediately after the blob write. Local dev uses the same SDK.

### 5.1 Per file type

| Type | Tabular rows | Text for embedding |
|---|---|---|
| `.xlsx` / `.xls` | Parse with `exceljs` or `xlsx`, one record per row per sheet into `dataset_rows`. | Per sheet: a text summary (`"Sheet 'Budget' with columns: month, dept, amount. 142 rows. Sample: Jan/ICT/56000..."`). |
| `.csv` | Parse with `papaparse`, one record per row. | Same summary format. |
| `.docx` | None. | Extract text with `mammoth`. Chunk by paragraph (~500 tokens, 50 overlap). |
| `.pptx` | None. | Extract slide text + speaker notes with a parser (e.g. `pptx2json`). Chunk by slide. |

### 5.2 Chunking & embedding

For each text chunk:
1. Skip if <30 chars (noise).
2. Embed with `embedText()` from `lib/ai/embed.ts`.
3. Insert into `documents` with `datasetId` set, `userId` = the admin who created the dataset.

Tabular rows are **not** embedded individually. Instead:
- One summary-per-sheet chunk captures the schema.
- Optionally, we embed an LLM-written narrative of the dataset ("This table reports FY2026 SLA cost allocations by department to SBU…") — useful for the chatbot to answer "what is this dataset about" without hitting the row store. This narrative is generated once by the proposer (§6) and stored as a chunk.

If the user asks a question that requires actual row aggregation (e.g. "total spend by department"), the chatbot calls a dedicated tool (`queryDatasetRows`) that runs a constrained SQL-ish query against `dataset_rows`. That tool is scoped to the card's `datasetId` and returns aggregated numbers — again, never row-dumping.

### 5.3 Failure handling

A single file's parse failure marks that file `failed` but does not block the rest. The Review step warns the admin and lets them remove the bad file or retry. Generate is allowed as long as ≥1 file is `ready`.

### 5.4 Job runner

Reuse the existing queue (Upstash QStash per `docs/setup/09-caching-queues.md`). One endpoint per stage: `/api/jobs/parse-file`, `/api/jobs/embed-chunks`. Keeps the API path small and idempotent on retry.

---

## 6. AI config proposal

Runs once, after all files parse, when the admin clicks **Generate** on the upload step.

### 6.1 Inputs to the proposer

- Dataset title + description (admin-provided).
- Per file: filename, detected columns with inferred types, row count, 5-row sample.
- Per document file: first ~2k tokens of extracted text.

Everything fits comfortably in one prompt; no retrieval needed at this stage because we're reasoning about *structure*, not content.

### 6.2 Output

A `CardConfigProposal` object (a draft `CardConfig`, same schema — see §7) plus a one-paragraph `narrative` and a suggested `systemPrompt` for the chatbot. The proposer is a single Claude call with structured output (Zod schema via AI SDK `generateObject`).

### 6.3 What the proposer chooses

- **Views**: 3–6 views per dataset is the target. Heuristics the prompt encourages:
  - One KPI strip (top-line numbers) if clearly aggregable columns exist.
  - One ranking/bar view on the dominant numeric column grouped by the dominant category column.
  - One distribution view if ≥2 numeric columns exist.
  - One scatter/quadrant if ≥2 numeric columns correlate meaningfully.
  - One table view of the raw rows (always included, last).
- **Columns per view**: picked from detected columns only. We do not let the model invent column names.
- **Titles and axis labels**: the model writes these; admin can overwrite.

### 6.4 Admin editing

The Review UI (§2.3) binds directly to the `CardConfig` object. Every proposer-chosen value is an editable field. The admin can also click "Regenerate proposal" to re-run §6 with a new seed — useful if the first proposal misses the intent.

---

## 7. `CardConfig` schema

One shape that covers builtin + generated cards.

```ts
// lib/datasets/types.ts sketch
export interface CardConfig {
  version: 1;
  columns: Column[];          // detected columns across all files, union
  views: View[];
}

export interface Column {
  id: string;                 // normalized: "sla_cost"
  label: string;              // display: "SLA cost"
  type: "number" | "integer" | "string" | "date" | "boolean";
  source: { fileId: string; sheet?: string; column: string };
  nullable: boolean;
}

export type View =
  | KpiStripView
  | BarView
  | LineView
  | ScatterView
  | PieView
  | TableView
  | MatrixView;

export interface BarView {
  kind: "bar";
  id: string;
  title: string;
  description?: string;
  x: { columnId: string; label?: string };
  y: { columnId: string; label?: string; aggregation?: "sum" | "avg" | "count" | "none" };
  groupBy?: { columnId: string };
  sort?: { by: "x" | "y"; dir: "asc" | "desc" };
  topN?: number;
}
// ...other views follow the same pattern
```

The renderer is a switch on `view.kind` → component. Each component receives `(view, rows)` and is responsible for its own interactivity (hover, sort, toggle). Cross-view filtering is v2.

**Why a discriminated union and not a generic "chart spec"** (Vega-lite, ECharts option object): those are too expressive. We want a tight set of view types the proposer can reliably produce and the admin can reliably edit in a form. Vega-lite's full API is an anti-goal.

---

## 8. Per-card chatbot

Every generated card gets its own row in `chatbots` at creation time. Each field is either inherited from the **platform default** (configured in the admin panel, see §12) or **overridden per chatbot**. An override is recorded whenever the admin changes that field in the Review step (§2.3) or later in `/dashboard/<slug>/edit`.

Platform-default-or-override fields:

- `provider` / `modelId` — which LLM to call.
- `temperature` — sampling temperature.
- `rateLimitTokens` / `rateLimitWindow` — per-user rate limit.
- `dailyCostCapUsd` — daily cost cap.

Always card-specific (never inherited):

- `slug`: `dataset-<datasetSlug>` (e.g. `dataset-q1-supplier-spend`).
- `name`: `<card title> Assistant`.
- `systemPrompt`: AI-generated in §6, editable by admin.
- `tools`: `["searchDatasetDocs", "queryDatasetRows", "renderChart", "renderTable", "renderKpiList"]`.
- `allowedRoles`: `[]` (open to all authed users; matches gallery access).

The `chatbots` schema already carries per-bot values for these fields. For the platform-wide fallback we reuse existing `platform_settings` columns (`fallback_provider`, `default_rate_limit_tokens`, `default_rate_limit_window`, `default_daily_cost_cap_usd`) and add two new ones (`default_chatbot_model_id`, `default_chatbot_temperature`) — see §12. The chatbot runtime resolves `effectiveConfig = { ...platformDefaults, ...chatbotRow }` at request time. Because existing `chatbots` columns are `NOT NULL DEFAULT`, the row value always wins today; the platform default applies when we move those columns to nullable in a later phase, or when seeding a new chatbot row.

`searchDatasetDocs` is a new tool variant of `searchDocs` that passes `ctx.datasetId` to `searchDocumentsByEmbedding`. `ctx.datasetId` is stamped onto the chatbot runtime context by the route handler based on the URL (`/dashboard/<slug>/chat` → look up card → inject `datasetId`).

`queryDatasetRows` is a new tool (see §5.2) for structured aggregations against `dataset_rows`. It accepts a constrained query spec (select columns, group by, aggregate, filter, limit) — not free SQL — so injection risk is zero and the response stays bounded.

Threads persist per card per user (the existing `threads` table already keys by `chatbotId + userId`).

---

## 9. The SBU Atlas as builtin card

On first migration:

1. Insert one row into `datasets` with `slug='sbu-performance-atlas'`, `kind='builtin'`, `config={ builtinKey: 'sbu-atlas' }`.
2. Link it to the existing `atlas-analyst` chatbot via `chatbotId`.
3. Gallery rendering checks `kind`: if `builtin`, render a tile with the builtin's title/description + route to the existing `/dashboard/sbu-performance-atlas` page which mounts today's hand-coded sections unchanged.
4. The generic renderer at `/dashboard/<slug>` checks `kind` too: for `builtin`, it lazy-loads the matching component tree from a small registry (`lib/datasets/builtins.ts`); for `generated`, it uses the `CardConfig` renderer.

No data migration, no refactor of the existing dashboard. The SBU Atlas keeps its rich custom chart components; new cards get the generic renderer.

---

## 10. Permissions

- Creating, editing, re-uploading, deleting a dataset: requires `admin` role (checked in route handler + server action).
- Viewing a card and using its chatbot: any authenticated user.
- A future per-card `allowedRoles` column can be added without schema pain, mirroring how `chatbots.allowedRoles` works. Not in v1.

---

## 11. Public share links

An admin can publish a card so anyone with the URL can view it without signing in. Toggled from the card view (§2.4) or the dedicated page at `/dashboard/<slug>/share`.

### 11.1 What's shared

The public page at `/s/<token>` renders:

- The full card view — same charts, same layout as the authed `/dashboard/<slug>` page.
- The card's chatbot, embedded — same tools, same scoped retrieval, same model.

It does **not** expose:

- Edit / Manage UI.
- The raw uploaded source files (no download links).
- Other cards (the gallery stays auth-gated).

### 11.2 Token model

`datasets.share_token` is a 32-byte URL-safe random string, unique. `share_enabled=true` + a non-null token is the gate. Rotating the token invalidates the old URL immediately. Disabling the share flips `share_enabled=false` without discarding the token so the admin can re-enable the same URL later; "Rotate" issues a fresh token.

### 11.3 Anonymous chatbot sessions

Public chatbot calls work, but under tighter constraints:

- No `userId`; threads live under a short-lived anonymous session keyed by a cookie.
- Per-IP rate limit, stricter than the authed default (admin-configurable — see §12).
- Independent daily cost cap per shared card (admin-configurable — see §12) so a public card can't drain the authed card's budget.
- Tools available: `searchDatasetDocs`, `queryDatasetRows`, `renderChart`, `renderTable`, `renderKpiList`. No tool that could read other users' or other cards' data.

### 11.4 Audit

Every share toggle and token rotation writes to `audit_log` (table already exists) with the admin's `userId`, the `datasetId`, and the action. Public chatbot requests are logged with the anonymous session id, not the admin's.

---

## 12. Admin configurability (platform settings)

Anything that might need tuning without a code change lives in `platform_settings`. New entries for this feature:

All flat columns on the existing `platform_settings` singleton. New columns added for this feature:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `dataset_max_file_bytes` | integer | `26_214_400` (25 MB) | Per-file upload cap. |
| `dataset_max_files_per_dataset` | integer | `10` | Per-card file count cap. |
| `dataset_max_datasets` | integer | `50` | Total live (non-deleted) datasets. |
| `dataset_max_rows_per_dataset` | integer | `100_000` | Sum of `dataset_rows` per card. Parse fails past this. |
| `default_chatbot_model_id` | varchar(64) enum | `NULL` | Platform-wide chatbot model fallback (§8). |
| `default_chatbot_temperature` | real | `0.3` | Platform-wide chatbot temperature fallback (§8). |
| `public_share_rate_limit_tokens` | integer | `10` | Anonymous chatbot tokens per window. |
| `public_share_rate_limit_window` | varchar(16) | `'1 h'` | Anonymous chatbot rate-limit window. |
| `public_share_daily_cost_cap_usd` | real | `2.0` | Per-shared-card anonymous daily cost cap. |

For chatbot provider + rate-limit + cost-cap defaults we reuse the existing `fallback_provider`, `default_rate_limit_tokens`, `default_rate_limit_window`, and `default_daily_cost_cap_usd` columns already on `platform_settings` — no duplication.

All editable in the admin panel (`/admin/settings`). Writes invalidate the in-process cache so runtime reads see new values on the next request.

---

## 13. Decisions

All of these were open questions in earlier drafts; they are now closed.

1. **File storage** — **Vercel Blob**. One blob per upload, key stored in `dataset_files.storage_key`. Hard-deletes (soft-delete sweep, §4) remove the blob alongside the DB rows.
2. **Limits** — 25 MB/file, 10 files/dataset, 50 datasets total. **Configurable in the admin panel** (§12). Defaults ship as constants but runtime reads `platform_settings`.
3. **Chatbot model defaults** — platform default (configurable in the admin panel) with **per-chatbot overrides** for provider/model, temperature, rate limit, and daily cost cap. System prompt is always per-chatbot. See §8.
4. **Deletion** — soft delete on `datasets.deleted_at`, matching `chatbots.deleted_at`. A cron sweep hard-deletes rows ≥30 days past soft-delete, cascading `dataset_files`, `dataset_rows`, `documents` (by `datasetId`), the Vercel Blob objects, and the card's chatbot row.
5. **Row count ceiling** — **100,000 rows per dataset** in v1. Stored as a platform setting (§12) so we can raise it without a code change if the JSONB approach holds up. Past the cap, parsing fails with a clear error in the Upload step.
6. **Re-uploading / appending** — out of scope for v1. Tracked for v2.
7. **Builtin registry** — designed for extensibility. `lib/datasets/builtins.ts` exports a map `builtinKey → { title, description, page, chatbotSlug }`. v1 ships with one entry (`sbu-atlas`); new entries are drop-in.
8. **Public share links** — **in v1.** See §11.
9. **Cross-card queries** — v2 only, and only via a dedicated "master chat" entry point configured in admin settings. The master chat can retrieve across all datasets the viewing user is allowed to see. Regular per-card chatbots never cross card boundaries.

---

## 14. Sequencing (implementation phases)

Rough ordering, one phase per PR. Each phase is shippable on its own — stopping after phase 2 leaves the app working with the existing SBU card intact, just with a gallery that has one tile.

1. **Schema + migrations.** `datasets`, `dataset_files`, `dataset_rows`, `documents.dataset_id`, plus the new `platform_settings` entries (§12). Drizzle migration + verifier.
2. **Gallery + builtin SBU card.** `/dashboard` renders tiles from DB; SBU Atlas registered as builtin. Existing dashboard moves under `/dashboard/sbu-performance-atlas`; old `/dashboard` URL redirects to the slug.
3. **Upload + parse pipeline.** Vercel Blob integration, per-type parsers, QStash job queue, `dataset_files.status` flow. Tested via API; no UI yet.
4. **Embedding pipeline + scoped search.** Chunk, embed, store with `datasetId`. Extend `searchDocumentsByEmbedding` + add `searchDatasetDocs` tool. Unit-test the scoping (a card's chatbot only sees its own chunks).
5. **AI proposer + Review UI.** `/dashboard/new` wizard, `generateObject` call with `CardConfigProposal` schema, Review page with live preview against parsed rows.
6. **Generic renderer.** `CardConfig` → components for `bar/line/scatter/pie/kpi/table/matrix`. Simple Recharts wrappers; reuse existing dashboard components where possible.
7. **Per-card chatbot seeding + scoped tools + `effectiveConfig` resolver.** Merge platform defaults with per-bot overrides at request time; wire `queryDatasetRows`.
8. **Edit / delete flows.** `/dashboard/<slug>/edit`, soft delete, 30-day hard-delete cron sweep (including Blob cleanup).
9. **Public share links.** Token generation, `/s/<token>` route, anonymous chatbot session wiring, audit-log entries for toggles, admin panel fields for the public rate limit / cost cap.
10. **Polishing.** Empty states, permission errors, upload-side rate limits, PostHog events, error boundaries on the renderer.

---

## 15. Non-goals (v1)

- Cross-card queries and "master chat" searching across datasets — v2 only, admin-configurable entry point.
- Real-time collaboration on a draft.
- Scheduled refresh / live data sources.
- Custom chart types beyond the 7 listed in §7.
- Per-view RBAC inside a card.
- Appending / re-uploading data to an existing card — v2.

These are deliberately deferred so v1 ships.
