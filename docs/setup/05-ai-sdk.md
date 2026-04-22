# 05 — AI SDK (Vercel AI SDK + Anthropic Claude)

**Phase:** 1 · **Depends on:** 01, 04 · **P0**

Drops the raw OpenAI SDK in favor of the **Vercel AI SDK** with **Anthropic Claude** as the primary model. Unlocks streaming, tool use, structured outputs, prompt caching, and one-line provider swaps. This is the single highest-leverage upgrade for an AI-SaaS template.

## Goal

- `generateText` / `streamText` / `generateObject` available everywhere.
- Anthropic Claude Sonnet 4.6 (fast, cheap) as default; OpenAI + Claude Opus 4.7 (max quality) as opt-in.
- A working `/chat` page that streams tokens in the browser.
- Tool use (function calling) wired with a sample `search-docs` tool.
- Prompt caching on system prompts for ~90% cost reduction.
- Structured outputs via `generateObject` + Zod.

## Stack

- **[Vercel AI SDK](https://sdk.vercel.ai)** — `ai` core + provider packages.
- **`@ai-sdk/anthropic`** — Claude provider.
- **`@ai-sdk/openai`** — fallback.
- **`@ai-sdk/react`** — `useChat()` hook for the UI.
- Model IDs as of April 2026: `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5-20251001`.

## Steps

### 1. Install

```bash
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/react zod
pnpm remove openai   # remove raw SDK
```

### 2. Delete `lib/ai/gpt.ts`

```bash
rm lib/ai/gpt.ts
```

Grep for any remaining imports and migrate them in step 5.

### 3. Provider client

```ts
// lib/ai/client.ts
import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

export const models = {
  // Fast, cheap, great default for most SaaS use cases
  default: anthropic("claude-sonnet-4-6"),
  // Maximum capability; use for hard reasoning, code, long-form writing
  smart: anthropic("claude-opus-4-7"),
  // Ultra-cheap; batch operations, embeddings generation prompts
  cheap: anthropic("claude-haiku-4-5-20251001"),
  // Fallback provider
  openaiFallback: openai("gpt-4o"),
  openaiCheap: openai("gpt-4o-mini"),
} as const;

export type ModelKey = keyof typeof models;
```

### 4. System prompt with caching

Claude's prompt caching gives up to 90% cost reduction on repeated system prompts. The Vercel AI SDK exposes this via `providerOptions.anthropic.cacheControl`:

```ts
// lib/ai/prompts/system.ts
export const SYSTEM_PROMPT = `You are a helpful assistant for {appName}.

Respond concisely. Use tools when available. If you're unsure, say so.

…any long static content here — this is what gets cached…`;

export const systemMessage = {
  role: "system" as const,
  content: SYSTEM_PROMPT,
  providerOptions: {
    anthropic: { cacheControl: { type: "ephemeral" as const } },
  },
};
```

Cache blocks apply to the block they're on **and everything before it** in the prompt. Put static content first, dynamic content last.

### 5. Tool registry

```ts
// lib/ai/tools/search-docs.ts
import { tool } from "ai";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db, documents } from "@/db";
import { embedText } from "@/lib/ai/embed";

export const searchDocs = tool({
  description: "Search the user's uploaded documents by semantic similarity.",
  inputSchema: z.object({
    query: z.string().describe("The natural-language search query."),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  execute: async ({ query, limit }) => {
    const embedding = await embedText(query);
    const rows = await db
      .select({
        id: documents.id,
        content: documents.content,
        distance: sql<number>`${documents.embedding} <=> ${embedding}`,
      })
      .from(documents)
      .orderBy(sql`${documents.embedding} <=> ${embedding}`)
      .limit(limit);
    return rows.map((r) => ({ id: r.id, content: r.content, score: 1 - r.distance }));
  },
});
```

```ts
// lib/ai/tools/index.ts
import { searchDocs } from "./search-docs";
export const tools = { searchDocs } as const;
```

### 6. Embeddings helper

```ts
// lib/ai/embed.ts
import "server-only";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

const model = openai.embedding("text-embedding-3-small"); // 1536 dims; matches db/schema/documents.ts

export async function embedText(text: string) {
  const { embedding } = await embed({ model, value: text });
  return embedding;
}
```

(Voyage via Anthropic is also an option — stick with OpenAI embeddings for parity with most RAG tutorials.)

### 7. Streaming chat API route

```ts
// app/api/v1/ai/chat/route.ts
import { streamText, convertToCoreMessages, type UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";
import { models } from "@/lib/ai/client";
import { systemMessage } from "@/lib/ai/prompts/system";
import { tools } from "@/lib/ai/tools";
import { ratelimit } from "@/lib/ratelimit";

export const runtime = "nodejs"; // tools may touch DB via Node driver
export const maxDuration = 60;   // seconds

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { success } = await ratelimit.ai.limit(userId);
  if (!success) return new Response("Rate limit exceeded", { status: 429 });

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: models.default,
    messages: [systemMessage, ...convertToCoreMessages(messages)],
    tools,
    maxSteps: 5, // allow tool-call loops up to 5 hops
    experimental_telemetry: { isEnabled: true, functionId: "chat" },
  });

  return result.toDataStreamResponse();
}
```

### 8. Client chat UI

```tsx
// app/(app)/chat/page.tsx
"use client";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: "/api/v1/ai/chat",
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <div key={m.id} className="rounded-lg border p-3">
            <div className="mb-1 text-xs uppercase text-muted-foreground">{m.role}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.toolInvocations?.map((t) => (
              <pre key={t.toolCallId} className="mt-2 rounded bg-muted p-2 text-xs">
                {t.toolName}({JSON.stringify(t.args)})
                {"result" in t ? `\n→ ${JSON.stringify(t.result, null, 2)}` : ""}
              </pre>
            ))}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input value={input} onChange={handleInputChange} placeholder="Ask anything…" />
        <Button type="submit" disabled={status === "submitted" || status === "streaming"}>Send</Button>
      </form>
    </div>
  );
}
```

### 9. Structured outputs (non-chat)

For deterministic outputs (project analysis, classification, extraction), use `generateObject`:

```ts
// lib/services/project-analysis.ts
import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/client";

const AnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export async function analyzeProject(input: { name: string; budget: number; timeline: string; description: string }) {
  const { object } = await generateObject({
    model: models.default,
    schema: AnalysisSchema,
    prompt: `Analyze feasibility of this project:\n\nName: ${input.name}\nBudget: $${input.budget}\nTimeline: ${input.timeline}\n\n${input.description}`,
  });
  return object;
}
```

Returns a fully typed, Zod-validated object. No JSON parsing, no `catch (e)` for bad outputs.

### 10. Rate-limit buckets for AI

In `lib/ratelimit/index.ts` (see doc 09), define an `ai` bucket with stricter limits — AI calls are expensive:

```ts
export const ratelimit = {
  ai: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 h"), analytics: true, prefix: "rl:ai" }),
  api: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "1 m"), analytics: true, prefix: "rl:api" }),
};
```

### 11. Token + cost observability

Log token usage for every request. Wire into PostHog events (doc 08):

```ts
// in streamText onFinish callback
onFinish: async ({ usage, finishReason }) => {
  await captureServerEvent({
    distinctId: userId,
    event: "ai_completion",
    properties: {
      model: "claude-sonnet-4-6",
      input_tokens: usage.promptTokens,
      output_tokens: usage.completionTokens,
      cache_read_tokens: usage.cachedPromptTokens ?? 0,
      finish_reason: finishReason,
    },
  });
},
```

## Model selection cheat-sheet

| Use case | Model | Why |
|----------|-------|-----|
| Default chat, tool use | `models.default` (Sonnet 4.6) | Best price/perf for 90% of work |
| Hard reasoning, code, long docs | `models.smart` (Opus 4.7) | When Sonnet's output is visibly worse |
| Background batch, embeddings prompts, simple classification | `models.cheap` (Haiku 4.5) | 1/10th the cost of Sonnet |
| Special OpenAI-only feature (o1 reasoning, GPT-image, specific fine-tune) | `models.openaiFallback` | Only when needed |

**Don't start with Opus.** Start with Sonnet; upgrade only if eval results prove it.

## Prompt caching rules

1. Put static content (system prompt, long instructions, RAG docs) **before** dynamic content.
2. Mark the last static message with `cacheControl: { type: "ephemeral" }`.
3. Cache lasts 5 minutes; refreshed on every hit.
4. Minimum block size: 1024 tokens (Sonnet/Opus), 2048 (Haiku).
5. Four cache breakpoints max per request — use them sparingly.

## Verification checklist

- [ ] `rg "from ['\"]openai['\"]"` returns zero — all AI goes through `@/lib/ai/client`.
- [ ] `/chat` page streams tokens token-by-token (watch the DOM update).
- [ ] Tool calls appear in the UI when Claude invokes `searchDocs`.
- [ ] Rate limit returns 429 after the Nth message within an hour.
- [ ] `generateObject` returns a typed, validated object.
- [ ] Cache tokens show up in PostHog `ai_completion` events after the 2nd identical request.

## Gotchas

- **Node runtime for tool routes that touch the DB.** `edge` is fine for pure LLM calls, but Drizzle + Neon HTTP driver works best on Node.
- **`maxDuration` on Vercel.** Default is 10 s — bump to 60 s for streaming chat.
- **Don't cache tiny prompts.** Caching has overhead; <1024 tokens net cost is positive.
- **Model IDs change.** Check the Anthropic model catalog before every new app; the IDs above are valid in April 2026.
- **Don't cross provider metadata boundaries.** `providerOptions.anthropic` is ignored by OpenAI and vice versa — safe to leave in place.
