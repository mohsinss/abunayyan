# Chatbot tools expansion — plan

**Target:** add seven new tools to the chatbot registry. Two are data-access (deterministic table reads + scenario math); five are visual render tools that extend `chat-message.tsx`'s inline rendering.

This doc is the spec; no code lives in this commit. Each tool gets a Zod parameter schema, a return shape, where it's mounted, and a renderer plan when applicable.

---

## 1. Goals & non-goals

### Goals
- Stop the working-capital bot from RAG-ing prose just to surface a number that already lives in `wc_sbus` or `wc_groups`.
- Let the model run "what-if" math via a tool instead of doing arithmetic in its head (which it does poorly on multi-step financial calcs).
- Cover the visualization gaps in the current `renderChart` / `renderTable` / `renderKpiList` set so the bot can draw a heatmap, quadrant, timeline, sparkline, or before/after delta.
- Both engines (`ai_sdk` and `anthropic_direct`) pick up new tools automatically through the existing `getToolsForBot()` registry and the Anthropic adapter — no per-engine duplication.

### Non-goals
- No new providers, no new models, no schema migrations.
- No web / external tools (`webSearch`, `webFetch`, `sendEmail`) — deferred per the prior discussion.
- No `auditLogQuery` (covered separately when admin Q&A becomes a real ask).

---

## 2. Tool inventory

| Tool id | Type | Mounted on |
|---|---|---|
| `wcSnapshot` | data (read) | `working-capital-analyst` |
| `wcScenarioCalc` | data (compute) | `working-capital-analyst` |
| `renderDelta` | render | both bots |
| `renderSparkline` | render | both bots |
| `renderHeatmap` | render | `atlas-analyst` (primary), available to others |
| `renderQuadrant` | render | `atlas-analyst` (primary), available to others |
| `renderTimeline` | render | both bots (primary use: audit-style history) |

---

## 3. Per-tool specs

### 3.1 `wcSnapshot`

Reads `wc_groups` / `wc_sbus` / `wc_narrative` directly.

**Params (Zod):**
```
{
  scope: "all" | "group" | "sbu" | "sbu-list" | "narrative",
  key?: string             // required when scope === "sbu", e.g. "KSB"
}
```

**Returns:**
- `scope: "group"` → `{ fiscalYear, groupRevenue, nwcTargetRelease, totals: { nwc, ccc, nwcPctRevenue, revenue } }` (totals computed via `derive.ts`).
- `scope: "sbu"` + `key` → the full SBU row (identity + 7 baselines + 7 targets + `notes[]`) plus `{ derived: { nwc, ccc, nwcPctOfGroupRevenue } }`.
- `scope: "sbu-list"` → array of `{ key, name, shareText, posture, ccc, nwc }` for the model to pick from when ambiguous.
- `scope: "narrative"` → array of `{ slot, title, body }` (active rows only).
- `scope: "all"` → group + every SBU + every narrative slot. Big payload (~5–6kB); use sparingly.

**Why it's the biggest single win:** the WC bot currently does a vector search on every numeric question. `searchDatasetDocs` returns a paragraph that *mentions* DPO; the model has to parse it. `wcSnapshot({ scope: "sbu", key: "KSB" })` returns `{ dpo: 50, tDpo: 120, ... }` deterministically, faster, and cheaper. The system prompt will be updated to prefer this tool over `searchDatasetDocs` when the question is numeric.

**Where the data comes from:** the existing `lib/db/queries/working-capital.ts` fetchers + `lib/working-capital-data/derive.ts` for computed fields. No new queries needed.

**RBAC:** any signed-in user (the WC bot is already gated by `requireUser`; SBU rows aren't sensitive).

---

### 3.2 `wcScenarioCalc`

Pure compute, no DB write. Mirrors what the dashboard's slider state does, but exposed as a tool.

**Params (Zod):**
```
{
  preset?: number,              // 0..1, applied to every SBU's baseline → target
  overrides?: Array<{
    sbuKey: string,
    field: "inv" | "ar" | "ca" | "ap" | "dio" | "dso" | "dpo",
    value: number              // raw value to set (after preset is applied)
  }>
}
```
Either or both. Preset runs first, then overrides win.

**Returns:**
```
{
  perSbu: Array<{
    key, name,
    nwcBase, nwcAdjusted, deltaNwc,
    cccBase, cccAdjusted, deltaCcc,
    cashRelease            // = nwcBase − nwcAdjusted
  }>,
  group: {
    nwcBase, nwcAdjusted,
    cccBase, cccAdjusted,
    revenue,
    nwcPctRevenueBase, nwcPctRevenueAdjusted,
    cashRelease,           // sum across SBUs
    targetRelease,         // wc_groups.nwc_target_release
    progressPct            // cashRelease / targetRelease, clamped 0..1
  }
}
```

**Reuses:** `applyPreset`, `groupTotalsOf`, `cashReleased`, `nwcOf`, `cccOf` from `derive.ts`. Math identical to the dashboard sliders → guaranteed consistency.

**Example use:** *"What's the cash release if only KSB hits target?"* → `{ overrides: [{ sbuKey: "KSB", field: "dpo", value: 120 }, ... ] }` → returns the per-SBU + group result. The model then renders `renderDelta` for the headline cash and a `renderTable` for the per-SBU deltas.

---

### 3.3 `renderDelta`

Single big-number "before → after" with tone.

**Params (Zod):**
```
{
  label: string,           // e.g. "Group cash release"
  before: number,
  after: number,
  unit?: string,           // "SAR m", "days", "%"
  precision?: number,      // decimal places, default 0
  tone?: "good" | "bad" | "neutral" | "auto"   // auto: direction-based + lower-is-better hint
}
```

**Renderer:** `components/dashboard/chat/chat-delta.tsx` — single row, label small + grey, then `[before] → [after]` in big tabular-num typography, and the delta in the tone color underneath. Pure HTML/CSS, no chart lib.

**Visible inline:** yes. Add `"renderDelta"` to `VISIBLE_TOOL_NAMES` in `chat-message.tsx`.

---

### 3.4 `renderSparkline`

Tiny inline trend, ~120 × 30 px, suitable for tooltip-sized facts.

**Params (Zod):**
```
{
  label: string,           // e.g. "DPO 4-quarter trend"
  values: number[],        // 2..24 points
  current?: number,        // optional headline number to display alongside
  unit?: string,
  tone?: "up-good" | "up-bad" | "neutral"
}
```

**Renderer:** `chat-sparkline.tsx` — pure SVG path; no axes, no labels on the chart itself, just dots at min/max and current. Headline number on the right.

**Visible inline:** yes.

---

### 3.5 `renderHeatmap`

Dense grid for matrices like the SLA × SBU allocation in Atlas, or "metric × period" tables.

**Params (Zod):**
```
{
  title: string,
  description?: string,
  xLabels: string[],          // 2..30
  yLabels: string[],          // 2..30
  cells: Array<{ x: number, y: number, value: number, label?: string }>,
                              // x/y are indices into xLabels/yLabels
  unit?: string,
  scale?: { min?: number, max?: number, palette?: "navy" | "diverging" | "warm" }
}
```

**Renderer:** `chat-heatmap.tsx` — pure CSS grid. Cell color from a 5-stop palette (navy: `#f0f6fd → #0b3378`; diverging: `#c8463a` ↔ `#0e8a5f` with `#fff` middle; warm: cream → gold → ember). Hover shows label/value/coords. No Chart.js plugin needed.

**Why CSS grid over chartjs-chart-matrix:** smaller bundle, no extra plugin install, easier to fit in the 480px chat bubble width.

**Visible inline:** yes.

---

### 3.6 `renderQuadrant`

Labeled 2-axis scatter — "Strong/Weak," "Fix/Optimise," etc.

**Params (Zod):**
```
{
  title: string,
  description?: string,
  xAxis: { label: string, unit?: string, threshold: number },
  yAxis: { label: string, unit?: string, threshold: number },
  quadrants?: { tl?: string, tr?: string, bl?: string, br?: string },
                              // labels rendered in the corners
  points: Array<{
    label: string,
    x: number,
    y: number,
    tone?: "good" | "bad" | "warn" | "neutral",
    size?: number             // optional bubble size
  }>
}
```

**Renderer:** `chat-quadrant.tsx` — Chart.js `scatter` (already in deps) with two annotation lines at the thresholds. Quadrant labels positioned at the corners via Chart.js's plugin API or a small overlay div. Tone maps to point color.

**Visible inline:** yes.

---

### 3.7 `renderTimeline`

Events on a horizontal time axis.

**Params (Zod):**
```
{
  title: string,
  description?: string,
  events: Array<{
    at: string,                    // ISO 8601
    label: string,
    detail?: string,
    tone?: "info" | "good" | "bad" | "warn",
    group?: string                 // optional swim-lane label
  }>,
  range?: { from: string, to: string }   // ISO; defaults to min/max event date
}
```

**Renderer:** `chat-timeline.tsx` — single horizontal axis (multiple swim-lanes if `group` is present), dots at event positions, hover tooltip for `detail`. Pure SVG; no Chart.js.

**Visible inline:** yes.

---

## 4. Implementation plan

### File layout (proposed)

```
lib/chatbots/tools/
  wc-snapshot.ts              NEW
  wc-scenario-calc.ts         NEW
  render-delta.ts             NEW
  render-sparkline.ts         NEW
  render-heatmap.ts           NEW
  render-quadrant.ts          NEW
  render-timeline.ts          NEW
  index.ts                    EDIT — register all 7 in ALL_TOOLS
  metadata.ts                 EDIT — add display metadata for the admin UI

components/dashboard/chat/
  chat-delta.tsx              NEW
  chat-sparkline.tsx          NEW
  chat-heatmap.tsx            NEW
  chat-quadrant.tsx           NEW
  chat-timeline.tsx           NEW
  chat-message.tsx            EDIT — extend VISIBLE_TOOL_NAMES + dispatch switch

db/schema/chatbots.ts         EDIT — add the 7 new ids to TOOL_IDS

lib/working-capital/retrain.ts  (no change)
lib/working-capital-data/derive.ts  EDIT — export a small applyOverrides helper for wcScenarioCalc
```

### Registry & per-bot wiring

After `TOOL_IDS` gains the new ids, `lib/chatbots/seed-defaults.ts` is unchanged for existing bots; we'll edit two bot rows in the DB (`atlas-analyst`, `working-capital-analyst`) via the admin chatbot edit UI to add the relevant tools — no migration needed since `chatbots.tools` is a `jsonb` array.

### Engine compatibility

- The `ai_sdk` runtime already iterates whatever's in `getToolsForBot()`'s output map. New tools light up automatically.
- The `anthropic_direct` runtime uses `lib/chatbots/tools/adapters/anthropic.ts`, which converts each tool's Zod schema via `zod-to-json-schema`. Same code path, no new logic.

### System prompt updates

- **`working-capital-analyst`**: insert a "tool routing" rule near the top:
  > For numeric questions about specific SBUs, call `wcSnapshot` first. For narrative or context questions, call `searchDatasetDocs`. For "what-if" questions, call `wcScenarioCalc`.
- **`atlas-analyst`**: extend the existing rendering rule to mention the new render tools (heatmap for the SLA matrix, quadrant for the strategy view).

Both updates go through the existing prompt-versioning flow (`updateSystemPrompt`) so we get a history snapshot.

---

## 5. Phasing

Each phase is independently shippable.

### Phase 1 — data tools (highest impact, ~1 day)
- `wcSnapshot` + `wcScenarioCalc`.
- Update `working-capital-analyst` system prompt to prefer these.
- No client changes needed; the model uses them in the model→tool→model loop and still answers via text + existing render tools.

### Phase 2 — simple renderers (~half day)
- `renderDelta` + `renderSparkline`.
- Both are tiny pure-CSS / pure-SVG components; trivial to add.

### Phase 3 — complex renderers (~1.5 days)
- `renderHeatmap` (CSS grid + palette helper).
- `renderQuadrant` (Chart.js scatter + annotation overlay).
- `renderTimeline` (SVG with optional swim-lanes).

### Phase 4 — bot config (~1 hour)
- Mount `wcSnapshot`, `wcScenarioCalc`, `renderDelta`, `renderSparkline` on `working-capital-analyst`.
- Mount `renderHeatmap`, `renderQuadrant`, `renderTimeline`, `renderDelta`, `renderSparkline` on `atlas-analyst`.
- Smoke test both bots against representative prompts.

**Total estimate: ~3 days end-to-end.**

---

## 6. Tests

| Layer | Test |
|---|---|
| Unit | `wcSnapshot` over mocked DB rows: every scope returns the right shape; missing key on `scope=sbu` errors cleanly. |
| Unit | `wcScenarioCalc`: preset 0 returns baseline unchanged; preset 1 hits target; per-SBU overrides win over preset. Math reuses the existing `derive.ts` tests so we don't duplicate. |
| Unit | Each render tool's Zod schema rejects malformed input (negative array sizes, missing required props). |
| Visual smoke | Storybook-style fixtures — one prompt per render tool with a hand-picked args payload; render in the chat shell and verify it doesn't break layout at 480px width. |
| Integration | End-to-end against `working-capital-analyst`: prompt *"What is KSB's DPO?"* should resolve via `wcSnapshot` (not `searchDatasetDocs`). Verified by inspecting the persisted assistant message's `tool_calls`. |

---

## 7. Open questions

1. **Should `renderHeatmap` use Chart.js's matrix plugin or hand-rolled CSS grid?** Default plan: CSS grid (smaller bundle, sized for chat). Reconsider if we ever need >30×30 matrices — unlikely.
2. **Should `wcSnapshot` cache per request?** Probably not — Drizzle reads against Neon HTTP are <10ms each, and we'd risk staleness right after an admin edit. Skip caching for v1.
3. **Should `wcScenarioCalc` accept percentage-style overrides** (e.g. `{ field: "dpo", changePct: -0.2 }`) **in addition to absolute values?** Default plan: absolute only for v1; the model can compute the percent itself before calling. Add later if it trips up.
4. **Tone palette for `renderHeatmap`** — three palettes (navy / diverging / warm) or one configurable color? Default: three named palettes; simpler for the model to pick.
5. **`renderTimeline` event detail tooltip** — show on hover only, or always render alongside the dot? Default: hover only, to keep dense timelines readable. Always-visible in tooltip mode `index` if needed.

---

## 8. Risks

- **Tool-routing regression on the WC bot.** Adding `wcSnapshot` doesn't remove `searchDatasetDocs`; if the prompt isn't tight enough, the model may pick the wrong one. Mitigated by the explicit system-prompt routing rule (§4) and the integration test in §6.
- **Render-tool "args == result" assumption.** The chat-message dispatch currently treats `inv.args` as the full result (since the renderers' execute is a pass-through). Phase 2/3 keeps that pattern — the new render tools return their args verbatim. Worth keeping in mind if we ever add a render tool with side effects.
- **Zod-to-JSON-Schema edge cases.** The Anthropic adapter handles `z.object`, `z.enum`, `z.array`, `z.union` already. If any new tool's schema uses something exotic (e.g. `z.discriminatedUnion`), test it through `anthropic_direct` explicitly.

---

## 9. TL;DR

Two data tools, five render tools, three days of work. Phase 1 (data tools) lands the biggest user-visible quality bump on the working-capital bot. Phase 2/3 fills the visual gaps. Engine compatibility is automatic — both `ai_sdk` and `anthropic_direct` pick the new tools up via the shared registry.

Confirm and I'll execute Phase 1 first, get it through smoke test, then proceed.
