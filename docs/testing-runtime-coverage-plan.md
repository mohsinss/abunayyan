# Plan: Test coverage for the chatbots runtime + persistence

## Goal

Bring real test coverage to the chatbots platform's "money paths" — the modules that
gate every chat turn and write every row. Today they are explicitly excluded from the
Vitest coverage gate (`vitest.config.ts`), and the only integration test
(`tests/integration/chat-route.test.ts`) mocks `runBotStream` wholesale, so the
orchestration and DB logic inside it are unexercised.

**Untested today:** `lib/chatbots/runtime.ts`, `persistence.ts`, `registry.ts`,
`prompts.ts`, `audit.ts`.
**Already covered (Upstash-mocked):** `rate-limit.ts`, `cost.ts`, `authz.ts`,
`providers.ts`, `route-handler.ts`.

## Fixture strategy (the core decision)

Two distinct kinds of tests, two distinct harnesses — don't force one tool to do both:

1. **Orchestration tests (no infra).** `runtime.ts` is pure control flow over injected
   dependencies. Test it by `vi.mock`-ing its collaborators (`settings`, `rate-limit`,
   `authz`, `persistence`, `audit`, and the two engine modules) and asserting the
   guard-rail *sequence*, short-circuits, error shapes, and audit events. Zero new
   dependencies. This is the highest value for the least effort and should land first.

2. **Real-SQL tests (in-process Postgres).** `persistence.ts`, `registry.ts`,
   `prompts.ts`, `audit.ts` are thin Drizzle query wrappers — mocking the query builder
   would test nothing. Run them against **PGlite** (`@electric-sql/pglite` +
   `drizzle-orm/pglite`), an in-process WASM Postgres. A fixture helper builds a PGlite
   Drizzle instance, applies the migrations once, and `vi.mock("@/db")` points the modules
   at it. Schema files (`db/schema/*`) are dialect-agnostic `pgTable` definitions, so they
   bind to PGlite unchanged; callers import `db` from `@/db` (mocked) and tables from
   `@/db/schema/*` (real), so only the `db` export needs swapping.

   *Why not Testcontainers / a Neon test branch?* Both need Docker or network + creds in
   CI; PGlite runs in the Vitest process with no external services, keeping the suite
   hermetic and fast (the current 190-test suite runs in ~2s).

   *pgvector wrinkle:* the `documents`/`datasets` migrations use the `vector` type. Load
   PGlite's vector extension (`@electric-sql/pglite/vector`) so the full migration set
   applies cleanly; this also unblocks future dataset/RAG query tests.

3. **Redis accounting (optional deepening).** `budget.check/record` is already tested via
   the Upstash mock. If we want real cost-accumulation/TTL assertions, add a small
   Map-backed Redis fake — but this is a stretch goal, not part of the core gap.

## Work breakdown

### Phase 1 — runtime.ts orchestration (no new deps) — *highest value*
`tests/unit/chatbots/runtime.test.ts`. Mock collaborators; assert:
- Guard order: global-disabled → access → rate-limit → budget → thread → persist → dispatch.
- Each gate short-circuits with the correct `RunError` kind **and** writes the matching
  audit event (`bot.access_denied`, `bot.rate_limited`, `bot.budget_exceeded`).
- `globalChatDisabled` returns `global_disabled` before any other call runs.
- Engine dispatch: `engine: "anthropic_direct"` with non-anthropic provider →
  `bot_disabled`; `anthropic_direct` + anthropic → direct engine; default/`ai_sdk` → AI SDK.
- User message is persisted + `autoTitleIfNeeded` called only when the last message is a
  non-empty user string; not on empty/assistant.
- Happy path returns `{ ok: true, threadId, result }`.
~15–20 tests. Add `runtime.ts` to the coverage `include` at ≥85%.

### Phase 2 — PGlite fixture + DB-bound modules
- `tests/fixtures/db.ts`: create PGlite (+ vector ext), apply `db/migrations/*.sql`,
  return a Drizzle instance + `reset()` (truncate between tests); export a `mockDb()` that
  wires `vi.mock("@/db")`.
- `persistence.test.ts`: `getOrCreateThread` (create vs reuse vs wrong-owner), `appendMessage`
  (insert + `threads.updatedAt` bump), `softDeleteThread` (owner-scoped), `getMessagesForThread`
  ordering, `autoTitleIfNeeded` (only first message, truncation at 80), `toUIMessage(s)` mapping.
- `registry.test.ts`: `getBotBySlug`/`getBotById` exclude soft-deleted; `listEnabledBotsForRole`
  role filtering (empty allowedRoles = all; disabled excluded).
- `prompts.test.ts`: `updateSystemPrompt` bumps version + writes history; `rollbackSystemPrompt`
  restores + appends a new history row (no destructive overwrite); `listPromptHistory` ordering.
- `audit.test.ts`: `writeAudit` inserts with the typed `AuditEvent`; payload JSON round-trips.
~25–30 tests. Add the four modules to the coverage `include`.

### Phase 3 (optional) — budget accounting against a Redis fake
Map-backed fake for `budget.check/record`: cap enforcement, cumulative spend, daily TTL key.
~8 tests.

## Dependencies to add (Phase 2)
- `@electric-sql/pglite` (dev)
- `drizzle-orm/pglite` is part of `drizzle-orm` (already installed) — no new dep.

## Effort
- Phase 1: ~0.5 day, no deps, no risk. **Do first.**
- Phase 2: ~1.5–2 days; the fixture harness is the real lift (migration application +
  pgvector ext), then the per-module tests are mechanical.
- Phase 3: ~0.5 day, optional.
Total ~2.5–3 days for Phases 1–2.

## Risks / open questions
- PGlite migration application: if any migration uses Neon-specific SQL beyond `vector`,
  the fixture may need a small allow/skip shim. Validate by applying the full set early.
- Keep PGlite tests in `tests/integration/**` (or a `tests/db/**` glob) so a developer
  without the WASM build cached can still run the fast unit subset.
- Coverage thresholds: raise the gate per module as each lands, rather than flipping all
  five at once (avoids a red gate mid-effort).
