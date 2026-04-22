# AHC SBU Performance Atlas — Build Plan

**Target:** a single long page with a persistent side-nav, seven analytical sections, and interactive controls on every visualization. Data is the FY2026 SLA model numbers taken verbatim from the mockup (14 SBUs + 15 HQ departments + a department-by-SBU allocation matrix). This doc describes *how* we'll build it before any code lands.

---

## 1. Guiding principles

1. **Single page, not a SPA.** The user explicitly asked for one long scroll with a side nav. Everything lives on `/dashboard`. No tabs, no separate routes per chart. Deep-linking is via URL hash (`#composite-ranking`) and preserved on reload.
2. **Data is frozen, views are fluid.** The numbers in the mockup don't change. What the user plays with is the *view*: sorts, filters, chart type, axis scaling, highlighted entity. This is the correct split — it keeps the data layer trivial (static module) and lets all the engineering energy go into interaction.
3. **Editorial aesthetic, not BI-tool aesthetic.** The mockup uses Fraunces serif + IBM Plex + cream/beige palette + accent gold. Default Tailwind/shadcn looks nothing like that. We will port the typography and color variables over — the dashboard should look like a commissioned briefing, not a PowerBI export.
4. **Cross-filter everything.** If a user hovers or clicks an entity anywhere (ranking row, scatter dot, heatmap column, bar), that entity is highlighted *everywhere* it appears. This is the single biggest usability win a multi-chart dashboard can offer and the user's brief ("play with them, change how they are displayed") points at it.
5. **No half-built interactivity.** Every chart ships with at least two real controls. If a control would be fake/decorative, we cut it.

---

## 2. Tech stack decisions

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router (already set up) | No change. Dashboard lives at `/app/(app)/dashboard/page.tsx`. |
| UI primitives | shadcn/ui (already set up) | Button, Tabs, Toggle, Select, Tooltip, Dropdown, Dialog, ScrollArea are all in `/components/ui/`. No new install. |
| Charts | **Recharts** | Composable React components, SSR-friendly, tree-shakes well, supports bar/scatter/line/area. Alternatives (visx, nivo, echarts) are either lower-level (visx) or bring heavy D3 bundles. Recharts fits a static-data dashboard. |
| Table | **TanStack Table v8** (headless) | The §02 performance table needs multi-column sort + filter + sticky headers. TanStack is the standard headless-table library in 2026; we keep full visual control. |
| Scroll-spy | **Native `IntersectionObserver`** via a small hook | No `react-scrollspy` dependency needed. ~20 LOC hook. |
| Smooth scroll | CSS `scroll-behavior: smooth` + `element.scrollIntoView({behavior:'smooth'})` | Native, no library. |
| Animation | **Framer Motion** (optional) for section-enter fades + chart tooltip transitions | Only pull in if we actually use it. Not required for MVP. |
| State | React `useState` + URL hash + a tiny `SelectedEntityContext` | No Zustand/Redux. State is shallow: selected entity, sort column, chart-type toggles, tier filter. Context handles cross-filter. |
| Fonts | Next/font with Fraunces + IBM Plex Sans + IBM Plex Mono | Self-hosted, no FOUT, matches mockup exactly. |
| Icons | Lucide (already installed) | — |

**Things we are NOT adding:** no D3, no Nivo, no Plotly, no Zustand, no React Query (data is static), no i18n, no CMS.

---

## 3. File structure

```
app/(app)/dashboard/
  page.tsx                      # Server component — composes all sections
  layout.tsx                    # Dashboard-specific layout (sidebar + main)
  sections/
    01-composite-ranking.tsx
    02-performance-table.tsx
    03-quadrant-analysis.tsx
    04-distribution.tsx
    05-cost-matrix.tsx
    06-departments.tsx
    07-strategic-readout.tsx

components/dashboard/
  sidebar-nav.tsx               # Sticky left nav, scroll-spy, jump-to-section
  kpi-strip.tsx                 # Top 6 KPIs
  header.tsx                    # Title + meta block
  section-shell.tsx             # Consistent wrapper: number, title, description, card
  entity-chip.tsx               # Pill with JV badge, reusable
  tier-badge.tsx                # Strong / Healthy / Watch / At Risk / Critical
  scatter-plot.tsx              # Recharts wrapper for both quadrants
  distribution-bars.tsx         # Revenue + op-profit bar charts
  cost-matrix.tsx               # Dept × SBU heatmap
  performance-table.tsx         # TanStack sortable table
  ranking-list.tsx              # §01 composite list
  department-card.tsx           # §06 single card
  strategy-cluster.tsx          # §07 single cluster card
  chart-controls.tsx            # Reusable toolbar: view toggle, sort, filter
  use-scroll-spy.ts             # Hook for active section detection
  use-selected-entity.ts        # Context hook for cross-filter
  selected-entity-provider.tsx  # Context provider

lib/dashboard/
  data.ts                       # All FY2026 numbers (typed, frozen)
  types.ts                      # Entity, Department, MatrixCell, Tier, KPI
  derived.ts                    # Computed metrics (SLA/OpP, post-SLA OpP, ranks)
  tokens.ts                     # Tier → color mapping, heatmap scale

app/globals.css                 # Add @font-face + editorial color vars
tailwind.config.ts              # Extend theme with editorial palette
```

**Why this split:**

- `sections/` are one-file-per-section because each section is self-contained, ~200–400 LOC, and reviewing a section diff shouldn't require scrolling past six other sections.
- `components/dashboard/` holds anything reused across sections (tier badge, entity chip, section shell, chart controls). This is the standard "smart section, dumb component" split.
- `lib/dashboard/` is the data layer. `data.ts` is hand-transcribed from the mockup. `derived.ts` computes ratios so the display components never do math. If the user later swaps `data.ts` for real xlsx-loaded data, nothing else changes.

---

## 4. Data model

All 14 operating entities, 15 HQ departments, and the 10×14 allocation matrix live as typed TypeScript consts in `lib/dashboard/data.ts`.

```ts
// types.ts sketch
export type Tier = 'strong' | 'healthy' | 'watch' | 'at-risk' | 'critical';

export interface Entity {
  id: string;                // 'wetico'
  name: string;              // 'Wetico'
  isJV: boolean;
  revenue: number;           // SAR
  opProfit: number;
  opMargin: number;          // 0.117 for 11.7%
  slaCost: number;
  headcount: number;
  compositeScore: number;    // 8.2 – 100
  rank: number;
  tier: Tier;
}

export interface Department {
  id: string;
  name: string;              // 'ICT'
  budget: number;            // 56.6M SAR
  recoveredPct: number;      // 0.878
  absorbed: number;
  shareOfOverhead: number;   // 0.398
  costDriver: string;        // 'User count'
  classification: 'tier1' | 'tier2' | 'tier3' | 'quickwin' | 'ceo-named' | 'wc-lever';
}

export interface MatrixCell {
  departmentId: string;
  entityId: string;
  amount: number;            // SAR (thousands in display)
}
```

Derived fields (`slaToOpP`, `slaToRevenue`, `opProfitPostSla`, etc.) are calculated once in `derived.ts` and memoized. Components never compute ratios inline.

**Why frozen static data:** the user said "do not change the data." A static module makes that literal. It also sidesteps loading states, error states, and hydration mismatches — all irrelevant for a briefing document.

---

## 5. Layout & navigation

### 5.1 Overall layout

```
┌────────┬─────────────────────────────────────────────┐
│        │  Header (title, meta, last-updated)         │
│        ├─────────────────────────────────────────────┤
│        │  KPI strip (6 tiles, full width)            │
│ Side   ├─────────────────────────────────────────────┤
│ Nav    │  § 01 Composite Ranking                     │
│ (fixed)│  § 02 Performance Table                     │
│        │  § 03 Quadrant Analysis                     │
│        │  § 04 Distribution                          │
│        │  § 05 Cost Matrix                           │
│        │  § 06 Department Budgets                    │
│        │  § 07 Strategic Readout                     │
└────────┴─────────────────────────────────────────────┘
```

- Sidebar is `position: sticky; top: 0; height: 100dvh` on `≥lg` screens. Collapses to a top hamburger on small screens (rare for this audience but free via shadcn Sheet).
- Main content area has `scroll-margin-top` on each section anchor so smooth-scrolled jumps leave a breathing gap under the (non-existent) top header.

### 5.2 Side nav

The sidebar is the primary navigation device. Contents:

1. Small logo/title lockup at top.
2. Seven section links, each with its § number, title, and a subtle micro-description.
3. A "scroll-spy" dot/bar on the active section (IntersectionObserver fires when a section's top crosses 40% viewport height).
4. Below the section list: a **global entity search** (command-k style) that scrolls to the entity's row in §02 and selects it via context — so searching "DCT" highlights DCT everywhere.
5. Footer: small "print" and "export PNG" buttons (nice-to-have, not MVP).

Clicking a nav item:
```ts
document.getElementById('composite-ranking')
  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
history.replaceState(null, '', '#composite-ranking');
```

### 5.3 In-chart navigation

The user's brief: "I could click on any part of the site that represents the graphs or charts or whatever and push the scroll dynamically to that part."

Concretely: every entity name rendered anywhere (ranking row, table row, scatter dot, bar, heatmap column header, cluster card) is clickable. Clicking it:

1. Sets `selectedEntity` in context (highlights the entity in all other charts).
2. Scrolls the §02 performance table into view and flashes that row.

This turns the dashboard into a cross-navigable atlas rather than seven disconnected charts.

---

## 6. Interactivity inventory

Per-section controls. These are deliberate, not decorative — each one answers a real "what if I…" question a reader might have.

### §01 Composite Ranking
- **Sort:** score ↑ / score ↓ / revenue / op-profit / SLA burden. Reorders rows with a brief Framer Motion layout animation.
- **Tier filter:** toggle chips to show/hide tiers.
- **Show JV only / operating-only / all:** segmented toggle.

### §02 Performance Table
- **Per-column sort** (click header to cycle asc/desc/none).
- **Global text filter** on entity name.
- **Tier filter** chips (synced with §01 — same context).
- **Column picker** (hide/show the 14 numeric columns for a cleaner view).
- **Pin row on click** — pinned rows stay at the top even when sorting.
- **Row click** → selects entity across the whole dashboard.

### §03 Quadrant Analysis (two scatter plots)
- **Linear ↔ log axis toggle** (x-axis on the damage-vs-scale chart defaults to log).
- **Show labels / labels on hover** toggle (14 labels gets busy).
- **Hover tooltip** with every key metric for that entity.
- **Click a dot** → select entity globally + highlight matching dot on the other scatter.

### §04 Distribution (Revenue + Op Profit)
- **View toggle:** bars ↔ treemap ↔ donut. Recharts supports all three with the same data shape.
- **Sort:** absolute value / share percent / alphabetical.
- **Include/exclude Wetico toggle** — Wetico dominates both charts (31.4% revenue, 45.6% profit). Letting the user remove the outlier reveals shape of the rest.

### §05 Department × SBU Cost Matrix
- **Row sort:** by total SLA / by department budget.
- **Column sort:** by total allocation received / alphabetical / tier.
- **Color scale:** quantile / linear / log — changes how the heatmap shades.
- **Cell hover:** tooltip with SAR amount + % of row + % of column.
- **Cell click:** selects both the dept and entity, highlights the row+column.

### §06 Department Budgets
- **Filter chips:** Tier 1 / Tier 2 / Tier 3 / Quick Win / CEO-named / WC Lever.
- **Sort:** budget size / absorbed gap / recovery %.
- **Card click:** scrolls to §05 and highlights that department's row.

### §07 Strategic Readout
- **Entity chips are clickable** — clicking "DCT" inside the Rescue cluster scrolls to §02 row.
- **Expand** state per card (mandate + stats collapsible).

---

## 7. Styling approach

The mockup uses a distinctive editorial palette and typography. We'll port it faithfully:

1. **Color tokens** added to `tailwind.config.ts` + `globals.css` as CSS variables matching the mockup's `:root` block (`--bg`, `--ink`, `--accent`, `--alert`, etc.). This replaces (additively, not destructively) shadcn's default HSL palette for dashboard-only components.
2. **Fonts** loaded via `next/font`:
   - Fraunces for serifs (display + mandates).
   - IBM Plex Sans for body.
   - IBM Plex Mono for labels, numbers, metadata.
3. **Component classNames** use Tailwind utilities + CSS variables. No styled-components, no CSS modules. Example:
   ```tsx
   <h2 className="font-serif text-[30px] tracking-[-0.5px]">
     Composite Performance <em className="text-accent italic">Ranking</em>
   </h2>
   ```
4. **Dark mode:** out of scope for V1. The editorial look is deliberately light/cream. If requested later, we add a `dark:` variant pass — the CSS-variable structure makes this a one-file change.
5. **Print styles:** the mockup already hints at print (`@media print`). We keep that — CFO/EPMO will want to print this.

---

## 8. Responsive behavior

- `≥1280px` (primary audience: laptops/desktops in boardroom): full layout, sidebar visible, 2-column and 3-column grids as designed.
- `768–1279px`: sidebar collapses to a top bar with anchor links; KPI strip wraps 3×2; grids collapse to single column where needed.
- `<768px`: not a primary target but shouldn't break. Everything stacks. Tables get horizontal scroll (already in design).

---

## 9. Accessibility

- Sidebar is a real `<nav>` with `<a href="#section">` links — keyboard-navigable, screen-reader-friendly, and falls back gracefully if JS fails.
- All chart tooltips are backed by an `aria-label` on the focusable element (Recharts supports this).
- Color is never the only signal: tier badges have text, scatter dots have labels (toggleable), heatmap cells have numeric values.
- Focus ring on every interactive element (shadcn default).
- The `<main>` element gets `tabIndex={-1}` + a skip link so keyboard users can jump past the sidebar.

---

## 10. Performance

- Dashboard is a server component by default; client components are only the interactive bits (scatter, table, heatmap, sidebar scroll-spy). Everything else is static HTML.
- Recharts and TanStack Table are imported with `next/dynamic` where they're below the fold (charts in §03–§06), so initial JS payload stays small.
- Data module is ~20 KB of TS and tree-shakes to whatever's used.
- No images other than static header text.
- Target: Lighthouse performance ≥ 95 on desktop.

---

## 11. Build phases

We'll land this in five PR-sized phases. Each phase produces something reviewable.

**Phase 1 — Foundation** *(no UI yet, but compiles and runs)*
- Add fonts, color tokens, globals.css updates, tailwind theme extension.
- Create `lib/dashboard/{types,data,derived,tokens}.ts` with all numbers from the mockup.
- Create empty `page.tsx` + `layout.tsx` scaffolding.
- Unit test (`vitest`) a few derived-field calculations against the mockup values to make sure the data transcription is correct.

**Phase 2 — Static shell**
- Header + KPI strip + all seven section shells with titles (no charts yet, just the layout).
- Sidebar with anchor links, sticky positioning, scroll-spy hook.
- This phase alone is enough to verify the page-level navigation feels right.

**Phase 3 — Visualizations, no interaction**
- §01 ranking list, §02 table (sortable only), §03 scatters, §04 bars, §05 heatmap, §06 cards, §07 readouts.
- Match the mockup visually. Every chart renders the right data.
- No cross-filter yet.

**Phase 4 — Interactive controls**
- Per-chart toolbars (view toggles, tier filters, sort controls).
- Scale/axis toggles.
- Search box in sidebar.

**Phase 5 — Cross-filter + polish**
- `SelectedEntityProvider` wired up.
- Clicking an entity anywhere highlights/scrolls globally.
- Motion transitions where they actually help (row reorder, tooltip fade).
- Print stylesheet.
- Accessibility audit pass.

Each phase is 1–2 days of focused work. Phase 1 is the critical one — if the data transcription is wrong, everything downstream is wrong.

---

## 12. Open questions for you before we start

Flagging these here rather than guessing:

1. **Auth.** `/dashboard` currently requires a signed-in user (`requireUser()`). Keep that, or make this page public/internal-only? The mockup says "Confidential · Distribution: CFO · Strategy · EPMO" which suggests auth stays.
2. **Real data source.** You mentioned "They will add the actual files." Is that xlsx that we should eventually load into this, or is the hand-transcribed FY2026 snapshot permanent? This affects whether we bother building an xlsx loader in Phase 1 or stay static.
3. **Export.** Do you want "Download PNG" / "Download PDF" / "Copy link" buttons? The audience probably *will* want to share a snapshot.
4. **Annotations.** Would you like readers to be able to pin a note on an entity/section, or is this read-only?

Defaults if you don't answer: keep auth, stay static, ship export as Phase-5 nice-to-have, no annotations.

---

## 13. What this plan explicitly does *not* include

To keep scope honest:

- No backend. No API routes for dashboard data. No database schema changes.
- No user preferences (saved sorts/filters per user).
- No real-time updates or websockets.
- No AI narrative generation (even though this app has Claude wired up — tempting, but out of scope).
- No role-based view (CFO vs EPMO seeing different cuts). Single audience view.
- No "what-if" simulator (e.g. "what if SLA drops 10%"). That's a different product.

If any of these become priorities later, they fit cleanly on top of the structure above without rewriting it.
