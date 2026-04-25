# Datasets-as-Cards — Parity with SBU Performance Atlas

Companion to [datasets-cards-plan.md](./datasets-cards-plan.md). The original plan said **"adapt to arbitrary tabular data"** and ended with a generic Recharts renderer. Production reality: a generated card looks and behaves like a much weaker cousin of the SBU page. This doc owns the gap and lays out a concrete plan to close it.

The user's brief, exactly:

> All generated cards must look somehow similar to the SBU Performance Atlas FY2026 — similar style, similar structure, similar functionalities. The chatbot must respond to that dataset in a similar way, using a vector database, like we did. The chatbot must be ready to go when I ask it; it will respond in a similar way to how it responded in the SBU, with the graphs, with tables.

Three dimensions matter: **chrome**, **charts**, **chatbot**. We've moved chrome to ~80% of SBU. Charts and chatbot are still far behind. This doc maps each dimension to concrete, shippable phases.

---

## 1. The honest gap (per dimension)

### 1.1 Chrome — *mostly closed*

| | SBU | Generated cards (today) | Status |
|---|---|---|---|
| Fonts (Fraunces serif + IBM Plex) | ✓ | ✓ | done |
| `atlas-scope` palette (cream + gold) | ✓ | ✓ | done |
| Sticky 260px sidebar w/ scroll-spy | ✓ | ✓ (driven by views) | done |
| Editorial header (eyebrow → italic gold title → byline → meta badge) | ✓ | ✓ | done |
| Numbered SectionShells (§ 01, § 02 …) | ✓ | ✓ | done |
| KpiStrip 6-tile grid | ✓ | ✓ | done |
| Floating editorial chat bubble | ✓ | ✓ | done |
| Sidebar entity search | ✓ | ✗ | **deliberately deferred** (SBU-bespoke; entities don't exist on generic cards) |
| Cross-filter highlighting (hover entity → highlights everywhere) | ✓ | ✗ | **gap** (Phase B) |

Chrome is 80% done. The remaining 20% (cross-filter) requires a generic "selected key" abstraction analogous to `SelectedEntityProvider` but driven by `CardConfig.columns`.

### 1.2 Charts — *the big gap*

SBU has bespoke chart components that go far beyond bar/line/pie/table. Each section is its own React component with its own controls.

| SBU section | What it is | Generic equivalent today |
|---|---|---|
| § 01 Composite Ranking | Sortable list with score bars, tier badges, sort key segmented control, ownership filter | None — bar view doesn't have controls |
| § 02 Performance Table | TanStack Table — multi-column sort, tier filter chips, name filter, threshold-coloured cells, click-to-highlight rows | Plain HTML table with pagination only |
| § 03 Quadrant Analysis | Scatter with quadrant zones, axis flip toggle (revenue/op-profit/SLA), tier-coloured dots, highlighted entity flash | None — proposer doesn't even output scatter views |
| § 04 Distribution | Multi-view: paired bars, jitter strip, sparkline-by-tier — segmented control switches | Plain bar |
| § 05 Cost Matrix | Department × SBU heatmap with per-cell tone, row/column hover totals, dept group toggles | None |
| § 06 Departments | Card grid: each card a dept w/ mini horizontal bars per SBU, classification ribbons | None — table view only |
| § 07 Strategic Readout | Clusters of bullet cards (CEO directives, Tier-1 pillars, quick wins) | None |

**Per-chart controls** (`components/dashboard/chart-controls.tsx` — `Segmented`, `FilterChips`, `Toolbar`) exist but the generic renderer doesn't use them. Every generated chart today is **inert** — no sort, no filter, no view toggle, no click-through.

This is the dimension that makes cards feel "dumb." Even if the proposer picks the right columns, the user can't *do* anything with the result.

### 1.3 Chatbot — *infrastructure right, behaviour wrong*

The pieces all exist:
- ✓ Per-card chatbot row seeded by `seedCardChatbot` with the right tools (`searchDatasetDocs`, `queryDatasetRows`, `renderChart`, `renderTable`, `renderKpiList`)
- ✓ Vector store wired (pgvector + `text-embedding-3-small` + HNSW index)
- ✓ `searchDatasetDocs` tool scopes to `dataset_id`
- ✓ `queryDatasetRows` tool runs constrained KPI / groupBy / pie / table aggregations against `dataset_rows`
- ✓ `chat-message.tsx` already renders `renderChart` / `renderTable` / `renderKpiList` invocations inline (same code Atlas uses)
- ✓ Floating `AtlasCardChat` bubble exists

So why doesn't it respond like Atlas? **Two reasons:**

**(a) The system prompt is a generic placeholder.** Atlas-analyst's prompt is a hand-written contract:

> Rules: keep chart labels under 22 characters and units as short abbreviations (SAR, %, M SAR). Never fabricate numbers. Only use figures from the snapshot. One paragraph of plain text, then the tool calls, then a one-line closer. Tone: concise, analyst, no marketing fluff.

The dataset card prompt today (`defaultPrompt` in `seed-chatbot.ts`) is generic guidance with no examples and no concrete column names:

> You are the assistant for the dataset card "X". Answer questions by calling searchDatasetDocs and queryDatasetRows. Use renderChart, renderTable, and renderKpiList to visualise answers inline.

Without explicit instructions to **always render a chart when relevant** and concrete examples of what columns to query, the model often just answers in prose.

**(b) "Ready to go" — no starter prompts.** Atlas has 4 hand-written suggestions ("What is Wetico's financial position?", "Which entities are AI rescue candidates?"). The dataset card chat has 4 generic suggestions ("What's in this dataset?", "Summarise in 3 bullets", "What are the top values?"). Generic = useless for a finance dataset, equally useless for a supplier-spend dataset. The proposer needs to write 4 dataset-specific starter prompts.

These two together explain ~all the chatbot disappointment. The render machinery is fine; the model just doesn't use it because nothing in its prompt forces the issue.

---

## 2. Implementation plan — phases, prioritized

Each phase ships independently. Phase A first because it unblocks the biggest disappointment (chatbot answering in prose only) and is the smallest blast radius.

### Phase A — Chatbot parity *(this commit)*

**A1. Atlas-style per-card system prompt.** Rewrite `defaultPrompt` in `lib/datasets/seed-chatbot.ts` to mirror `ATLAS_PROMPT`'s structure: role, hard rules, mandatory tool-use instructions, output format ("one paragraph → tool calls → one-line closer"), tone. Plug in the dataset's title and column list so the model knows the universe.

**A2. Proposer also writes the system prompt.** `lib/datasets/proposer.ts` already returns `chatbotSystemPrompt`. Strengthen the prompt-for-the-prompt so the AI emits an Atlas-style contract grounded in the actual columns it just picked. Saved into `dataset.config.chatbotSystemPrompt`; `seedCardChatbot` already consumes it.

**A3. Starter prompts in the bubble.** Extend `CardConfigProposalSchema` with `starterPrompts: string[]` (4 items, dataset-specific). Persist in `config.starterPrompts`. Wire to `AtlasCardChat`'s `suggestions` prop so the empty-state buttons are actually useful.

**A4. Re-seed atlas-scope styling for the dataset chat surface.** It already inherits the atlas scope from the card layout, but the chat opened via the floating bubble can render with a default font when mounted outside the scope. Verify it sits inside the layout's font/scope wrapper.

**Acceptance:** open a generated card, click the bubble, see 4 dataset-specific starter prompts. Click one. Bot returns one paragraph + a `renderChart` (or `renderTable`) inline. No prose-only dumps.

### Phase B — Per-chart controls *(next commit)*

Wrap each view with a `Toolbar` from `chart-controls.tsx`:

- **bar/line view** — Segmented sort key (alphabetical / value asc / value desc), TopN selector (10 / 25 / all)
- **pie view** — TopN selector (5 / 10 / all)
- **table view** — Replace HTML table with TanStack Table; column sort, name filter input
- **kpi view** — no controls (it's a tile)

`SelectedEntityProvider` becomes `SelectedKeyProvider` taking a generic `xColumnId + key`. Hover any bar / table row / pie slice → highlight everywhere.

**Acceptance:** every chart on a generated card has at least one working control. Hovering "NA" on a region bar dims the rest and highlights the matching pie slice.

### Phase C — More chart kinds *(next commit)*

Expand `CardConfigProposalSchema.views` discriminated union with:

- `scatter` — two numeric columns + optional series. Quadrant overlay if both axes have a meaningful midpoint. (SBU §03 equivalent.)
- `ranking` — one category × one numeric, rendered as horizontal score bars with rank numbers + tier-style colour bands. (SBU §01.)
- `distribution` — one numeric, rendered as histogram OR jitter strip OR sorted dot plot via segmented control. (SBU §04.)
- `heatmap` — two categorical × one numeric. Auto-cell colouring. (SBU §05.)

Update the proposer's system prompt to explain when to pick each kind. Renderer dispatch + view component per kind.

**Acceptance:** for a sales-by-region-by-quarter dataset, the proposer outputs (kpi strip + ranking + distribution + heatmap + table) instead of (kpi + bar + bar + table).

### Phase D — Cross-card consistency *(later)*

- Re-theme the gallery tiles to use atlas tokens (currently shadcn defaults).
- Re-theme the wizard + review form to inherit the atlas scope (currently default).
- Theme the `/edit` page and Manage UI.
- Theme the public `/s/[token]` page.

**Acceptance:** every dataset-touching surface uses the same fonts + palette + section rhythm. No "shadcn default" islands left.

### Phase E — Render tool richness *(later)*

`renderChart` today supports `bar | horizontal-bar | pie | scatter`. SBU's chat answers feel rich because the model has those four; for dataset cards we want the same. Already works. But if Phase C adds `ranking` / `distribution` / `heatmap` as renderer kinds, consider adding them to `renderChart` too so the chatbot can emit them inline.

---

## 3. What we're explicitly *not* trying to match

These are SBU-bespoke and don't generalise without a forcing function from the user:

- **Hand-written narrative copy** ("the Chairman's three-point directive on working capital"). The proposer writes 1–2 sentences; that's the right size.
- **Hand-curated KPI strip** with named tiles like "AI Rescue Candidates." Generated cards' KPIs are aggregations, not editorial calls.
- **Strategic Readout sections** (CEO directive clusters, quick-win lists). These are policy artifacts the user authors per dataset.
- **Entity-level domain logic** (JV badge, tier classification, score formulas). The proposer doesn't know what an "entity" is in the user's data; it just sees columns.
- **Custom CSS animations** (atlas-flash on highlight, scroll spotlight). Phase B may pull a subset in for cross-filter.

---

## 4. Minimum acceptance criteria for "feels like SBU"

A user creating a Q1 supplier-spend card should see:

1. **Same chrome** as SBU — fonts, palette, sidebar, header, KpiStrip, SectionShells, floating chat. *(done in last commit)*
2. **At least one chart per section is interactive** — sortable / filterable / view-toggleable. *(Phase B)*
3. **Variety of chart kinds** — not just bar+pie+table. Ranking lists, scatter plots, heatmaps where the data warrants. *(Phase C)*
4. **Chat opens with concrete starter prompts** about THIS dataset. *(Phase A)*
5. **First chat response renders a chart or table inline**, not a wall of prose. *(Phase A)*
6. **All answers are grounded** — the model never invents numbers. *(prompt rule, Phase A)*

---

## 5. This commit closes Phase A

What ships:
- Re-written `defaultPrompt` in `seed-chatbot.ts` mirroring the Atlas-analyst contract: role, mandatory tool-use, output rhythm (paragraph → tools → closer), no-fabrication rule, tone.
- Proposer system prompt extended to write that same contract style for each card, grounded in the actual proposed columns.
- `CardConfigProposalSchema.starterPrompts` (4 items, max 80 chars each).
- Wizard / review form / edit form pass through; saved into `config.starterPrompts`.
- `AtlasCardChat` reads `config.starterPrompts` and shows them as the empty-state buttons.

Phases B–E are tracked here and will land as separate commits. The user said "inject full analysis and write down documentation on how to implement it" — this doc is the contract for everything still to do.
