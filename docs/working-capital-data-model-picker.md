# Working Capital Data — Engine + Model picker

**Target:** add an admin UI on `/admin/working-capital` to pick which **engine** drives the chatbot — Vercel AI SDK (current), direct Anthropic SDK, or direct OpenAI SDK — and within that engine, which **model**. Vercel AI SDK is preserved unchanged; the two new direct paths run in parallel.

---

## 1. Why three engines, not "provider switching"

The codebase already supports `provider: anthropic | openai | google | xai` via `@ai-sdk/*` plugins — those are all "Vercel AI SDK as the orchestrator, talking to provider X". That's one engine.

The new feature is **two more engines** that bypass the Vercel AI SDK entirely and use the official provider SDKs:

| Engine | Package | Multi-step tool loop | Streaming protocol |
|---|---|---|---|
| `ai_sdk` (current) | `ai` + `@ai-sdk/anthropic` / `-openai` / `-google` / `-xai` | provided by SDK (`maxSteps`) | Vercel DataStream |
| `anthropic_direct` | `@anthropic-ai/sdk` (official) | hand-rolled | Vercel DataStream (we emit it manually) |
| `openai_direct` | `openai` (official) | hand-rolled | Vercel DataStream (we emit it manually) |

**Vercel DataStream is preserved across all three engines** so the React client (`@ai-sdk/react` `useChat`) keeps working. The chat component, the message persistence, and the audit logging are engine-agnostic.

---

## 2. Schema change

Add ONE column to `chatbots`:

```ts
// db/schema/chatbots.ts
export const ENGINES = ["ai_sdk", "anthropic_direct", "openai_direct"] as const;
export type Engine = (typeof ENGINES)[number];

engine: varchar("engine", { length: 24, enum: ENGINES })
  .default("ai_sdk")
  .notNull(),
```

Existing rows default to `ai_sdk` → **zero behaviour change for any bot already in the DB**.

Migration is purely additive (one new column with a default), so safe to ship without coordination.

---

## 3. File layout

```
lib/chatbots/
  runtime.ts                  # existing — Vercel AI SDK path (unchanged)
  runtime-anthropic.ts        # NEW — direct @anthropic-ai/sdk path
  runtime-openai.ts           # NEW — direct openai path
  runtime-dispatch.ts         # NEW — picks the right runtime by bot.engine
  models-catalog.ts           # NEW — unified provider/model/price registry
  tools/                      # existing — tool definitions stay, with adapters per engine
    adapters/
      anthropic.ts            # NEW — convert ToolDefinition → Anthropic tool schema
      openai.ts               # NEW — convert ToolDefinition → OpenAI tool schema

app/(app)/admin/working-capital/
  page.tsx                    # add <ModelPickerForm /> at top
  model-picker-form.tsx       # NEW — engine + provider + model + temp + maxTokens
  actions.ts                  # add updateChatbotRuntimeAction
```

---

## 4. The dispatch layer

The existing chat route handler stays unchanged. It calls `runBotStream(...)` which used to be defined in `runtime.ts`. We move that to `runtime-dispatch.ts`:

```ts
// lib/chatbots/runtime-dispatch.ts
export async function runBotStream(args: RunBotArgs): Promise<RunBotResult> {
  switch (args.bot.engine) {
    case "ai_sdk":
      return runViaAiSdk(args);            // current implementation, renamed
    case "anthropic_direct":
      assert(args.bot.provider === "anthropic", "engine/provider mismatch");
      return runViaAnthropicDirect(args);
    case "openai_direct":
      assert(args.bot.provider === "openai", "engine/provider mismatch");
      return runViaOpenAIDirect(args);
  }
}
```

The signatures of all three runtimes are identical:

```ts
type RunBotArgs = {
  bot: Chatbot;
  user: { id: string; role: UserRole; disabled: boolean };
  threadId?: string;
  messages: CoreMessage[];
  datasetId: string | null;
};

type RunBotResult =
  | { ok: true; threadId: string; result: { toDataStreamResponse: (init: ResponseInit) => Response } }
  | { ok: false; error: RunBotError };
```

So `route-handler.ts` doesn't change at all.

---

## 5. The two new runtimes

### 5.1 `runtime-anthropic.ts`

```
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
```

**Multi-step tool loop (hand-rolled):**

1. Convert our `ToolDefinition[]` into Anthropic's `tools: [{ name, description, input_schema }]` format via `tools/adapters/anthropic.ts` (Zod → JSON Schema).
2. Open a `client.messages.stream({ model, system, messages, tools, max_tokens, temperature })` SSE.
3. As tokens arrive, push them into our DataStream output (text deltas → `0:` chunks, tool calls → `9:` / `a:` chunks per Vercel protocol).
4. On `message_stop` with `stop_reason: "tool_use"`:
   - Execute each tool call locally via the existing `getToolsForBot()` registry.
   - Append `tool_result` blocks to the message history.
   - Loop back to step 2 with the updated history.
5. Stop when `stop_reason: "end_turn"` OR step count ≥ `bot.maxSteps`.
6. Capture `usage` from the final response (`input_tokens`, `output_tokens`).
7. Call `onFinish({ text, toolCalls, usage, finishReason })` — same shape as the AI SDK path, so persistence + audit + cost recording work identically.

**Streaming wire format:** use `createDataStream()` from `ai` (not `streamText` — just the lower-level helper) to write the Vercel DataStream protocol manually. This keeps the client (`useChat`) compatible without a full re-implementation.

### 5.2 `runtime-openai.ts`

```
import OpenAI from "openai";
const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
```

**Same shape as the Anthropic runtime, with these provider-specific differences:**

- Tools converted to OpenAI's `tools: [{ type: "function", function: { name, description, parameters } }]` shape.
- Streaming via `client.chat.completions.create({ stream: true, ..., tools })`.
- Tool calls arrive as `delta.tool_calls[]` chunks; we accumulate per-call until `finish_reason: "tool_calls"`.
- Tool results are sent back as messages with `role: "tool"` + `tool_call_id`.
- Usage comes from `chunk.usage` on the final chunk (only when `stream_options: { include_usage: true }`).
- Loop until `finish_reason: "stop"` OR step count ≥ `bot.maxSteps`.

### 5.3 Tool adapters

The existing `ToolDefinition` shape (`{ id, description, costClass, builder(ctx) → tool() }`) builds Vercel AI SDK `tool()` objects. We add two thin adapters:

```ts
// lib/chatbots/tools/adapters/anthropic.ts
export function toAnthropicTools(defs: ToolDefinition[], ctx: ToolCtx): {
  tools: AnthropicTool[];        // for the API request
  execute: (name: string, args: unknown) => Promise<unknown>;  // dispatcher
};

// lib/chatbots/tools/adapters/openai.ts
export function toOpenAITools(defs: ToolDefinition[], ctx: ToolCtx): {
  tools: OpenAIChatTool[];
  execute: (name: string, args: unknown) => Promise<unknown>;
};
```

Both use `zod-to-json-schema` (already a transitive dep via `ai`) to convert the existing Zod parameter schemas into JSON Schema for the API.

The `execute` dispatcher reuses the same `tool().execute` from each definition so search/render/etc. tools work identically across all three engines.

---

## 6. Cost computation

`lib/chatbots/cost.ts` already has `estimateCostUsd(provider, modelId, usage)`. The two new runtimes call this with the same provider + modelId — no change needed.

What we DO add: a `MODEL_CATALOG` in `lib/chatbots/models-catalog.ts` so the admin form can show prices inline. Single source of truth, prices in $/M tokens. (Same content as the table already used by `cost.ts` — we move it there and re-export.)

---

## 7. Admin UI

### `/admin/working-capital` — new section at top

```
┌─ Chatbot engine ──────────────────────────────────────────┐
│  Engine:                                                   │
│   ◯ Vercel AI SDK         (default · supports all 4 prov)  │
│   ◯ Anthropic (direct)    (no SDK overhead, raw access)    │
│   ◯ OpenAI (direct)       (no SDK overhead, raw access)    │
│                                                            │
│  Provider:    [ Anthropic ▾ ]  ← locked when direct engine │
│  Model:       [ Claude Sonnet 4.6 ▾ ]                      │
│                ┌─────────────────────────────────────┐     │
│                │ Claude Opus 4.7      $15 / $75 /M  │     │
│                │ Claude Sonnet 4.6    $3  / $15 /M  │ ✓   │
│                │ Claude Haiku 4.5     $1  / $5  /M  │     │
│                └─────────────────────────────────────┘     │
│                                                            │
│  Temperature: [ 0.3 ]   Max tokens: [ — ]                  │
│  Max steps:   [ 6   ]                                      │
│                                                            │
│  Estimated cost: ~$0.041 / turn                            │
│  (avg from last 50 turns: 11.4k in, 470 out)               │
│                                                            │
│  [ Save chatbot configuration ]                            │
└────────────────────────────────────────────────────────────┘
```

**Behaviour:**

- `Vercel AI SDK` engine → all 4 providers selectable, all their models.
- `Anthropic (direct)` engine → provider locked to `anthropic`; model dropdown shows only Anthropic models.
- `OpenAI (direct)` engine → provider locked to `openai`; model dropdown shows only OpenAI models.
- Engine options are disabled (with tooltip) if the corresponding API key env var is missing.
- Cost estimate recomputes live from the catalog as the model changes.

### `actions.ts`

```ts
export async function updateChatbotRuntimeAction(formData: FormData) {
  const actor = await requireRole("admin");
  // Validate engine ∈ ENGINES, provider ∈ AI_PROVIDERS, model ∈ catalog[provider]
  // Reject impossible combos: anthropic_direct with provider=openai, etc.
  // Update bot row + write audit event "working_capital.runtime_changed"
  // revalidatePath("/admin/working-capital")
}
```

New audit event: `working_capital.runtime_changed`, payload:

```json
{ "from": { "engine": "ai_sdk", "provider": "anthropic", "modelId": "claude-sonnet-4-6" },
  "to":   { "engine": "anthropic_direct", "provider": "anthropic", "modelId": "claude-opus-4-7" } }
```

---

## 8. What stays untouched

- The chat route handler (`/api/v1/chatbots/[slug]/chat/route.ts`).
- The `WorkingCapitalChat` and `AtlasChat` client components.
- Message persistence (`lib/chatbots/persistence.ts`).
- Cost recording, audit logging, rate limiting, budget caps.
- The retrain pipeline (Phase 5 of the data plan).
- The Vercel AI SDK runtime path — only renamed/moved into `runViaAiSdk()`.

The change is **purely additive** at the runtime layer. Existing bots (`atlas-analyst`, `general`, `working-capital-analyst`) keep their `engine: "ai_sdk"` default and behave identically.

---

## 9. Implementation phases

### Phase A — schema + dispatcher (1 day)
1. Add `engine` column + migration.
2. Add `models-catalog.ts`.
3. Move existing `runBotStream` body → `runViaAiSdk()`.
4. New `runtime-dispatch.ts` with `engine === "ai_sdk"` arm only.
5. Confirm zero behaviour change: existing bots still work end-to-end.

### Phase B — Anthropic direct runtime (1.5 days)
1. Install `@anthropic-ai/sdk` (already a transitive dep via `@ai-sdk/anthropic`; promote to direct).
2. Implement `runtime-anthropic.ts` with the multi-step loop.
3. Implement `tools/adapters/anthropic.ts`.
4. Smoke test against `working-capital-analyst`: switch engine → ask same questions → verify text + chart + costs match within ~5% of AI SDK.

### Phase C — OpenAI direct runtime (1.5 days)
1. Install `openai` package.
2. Implement `runtime-openai.ts`.
3. Implement `tools/adapters/openai.ts`.
4. Smoke test against the same bot with `engine: openai_direct` + a GPT-4o variant.

### Phase D — admin UI (0.5 day)
1. `model-picker-form.tsx` + `updateChatbotRuntimeAction`.
2. New audit event in `audit-log.ts`.
3. Cost-estimate query against `audit_log`.

**Total: ~4.5 days.** Each phase is independently shippable; you can stop after A+B if OpenAI direct isn't needed yet.

---

## 10. Tests

| Layer | Test |
|---|---|
| Unit | Tool adapters: feed a Zod schema, assert correct Anthropic + OpenAI JSON Schema output. |
| Unit | Multi-step loop: mock the SDK client, simulate tool_use → tool_result → end_turn, assert correct message accumulation. |
| Integration | All three engines hit a fake provider that echoes back, assert identical `appendMessage` + `writeAudit` payloads. |
| Manual | Side-by-side: ask `working-capital-analyst` the same 5 questions on each engine, compare answer quality, latency, cost. |

---

## 11. Open questions

1. **Does Anthropic prompt caching turn on automatically with `anthropic_direct`?** No — it requires explicit `cache_control` markers on system / tool / message blocks. We add them in a follow-up if cost becomes an issue. Default direct path stays uncached (matches current behaviour).
2. **Should `engine` default to something other than `ai_sdk` for new bots?** No — the AI SDK is the most flexible default. Direct engines are for bots that need provider-specific features.
3. **What if the user picks `anthropic_direct` but `ANTHROPIC_API_KEY` is missing?** Server action rejects with a clear error; UI greys out the option upfront.
4. **Streaming protocol risk:** writing the Vercel DataStream by hand is the riskiest piece. If we hit ambiguity, the fallback is to use `streamText` with a custom provider that wraps the direct SDK — slightly defeats the point but keeps the protocol guaranteed-correct. Decide after Phase A is in place.

---

## 12. TL;DR

Add a `chatbots.engine` column. Three runtimes live in parallel:

- `ai_sdk` (current, unchanged) — Vercel AI SDK + 4 providers.
- `anthropic_direct` — `@anthropic-ai/sdk` directly, hand-rolled tool loop.
- `openai_direct` — `openai` directly, hand-rolled tool loop.

Admin picks engine + provider + model on `/admin/working-capital`. Existing bots default to `ai_sdk` so nothing changes unless you flip the toggle. ~4.5 days end-to-end, phased so each piece ships independently.

Confirm scope and I'll execute Phase A first.
