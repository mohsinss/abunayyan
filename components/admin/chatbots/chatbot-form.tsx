"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AI_PROVIDERS,
  ENGINES,
  MODEL_IDS,
  TOOL_IDS,
  type AiProvider,
  type Engine,
  type ModelId,
} from "@/db/schema/chatbots";
import { USER_ROLES } from "@/db/schema/users";
import { TOOL_METADATA } from "@/lib/chatbots/tools/metadata";
import type { Chatbot } from "@/db/schema/chatbots";
import {
  createChatbotAction,
  updateChatbotAction,
  deleteChatbotAction,
} from "@/app/(app)/admin/actions";

const WINDOWS = ["1 m", "5 m", "15 m", "1 h", "1 d"] as const;

const MODEL_BY_PROVIDER: Record<AiProvider, readonly ModelId[]> = {
  anthropic: MODEL_IDS.filter((m) => m.startsWith("claude-")) as ModelId[],
  openai: ["gpt-4o", "gpt-4o-mini", "o3-mini"] as ModelId[],
  google: MODEL_IDS.filter((m) => m.startsWith("gemini-")) as ModelId[],
  xai: MODEL_IDS.filter((m) => m.startsWith("grok-")) as ModelId[],
};

const TOOL_META_BY_ID = TOOL_METADATA.reduce<Record<string, { description: string; costClass?: string }>>(
  (acc, t) => {
    acc[t.id] = { description: t.description, costClass: t.costClass };
    return acc;
  },
  {},
);

type Props = {
  mode: "create" | "edit";
  bot?: Chatbot;
  availableProviders: AiProvider[];
};

export function ChatbotForm({ mode, bot, availableProviders }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProvider>(bot?.provider ?? "anthropic");
  const [modelId, setModelId] = useState<ModelId>(
    bot?.modelId ?? MODEL_BY_PROVIDER[bot?.provider ?? "anthropic"][0]!,
  );
  const [engine, setEngine] = useState<Engine>(bot?.engine ?? "ai_sdk");

  function onProviderChange(next: AiProvider) {
    setProvider(next);
    setModelId(MODEL_BY_PROVIDER[next][0]!);
    // Direct engines lock provider; if the user picks google/xai while
    // engine=anthropic_direct, snap engine back to ai_sdk.
    if (engine === "anthropic_direct" && next !== "anthropic") setEngine("ai_sdk");
    if (engine === "openai_direct" && next !== "openai") setEngine("ai_sdk");
  }

  function onEngineChange(next: Engine) {
    setEngine(next);
    if (next === "anthropic_direct" && provider !== "anthropic") {
      setProvider("anthropic");
      setModelId(MODEL_BY_PROVIDER.anthropic[0]!);
    }
    if (next === "openai_direct" && provider !== "openai") {
      setProvider("openai");
      setModelId(MODEL_BY_PROVIDER.openai[0]!);
    }
  }

  const isEdit = mode === "edit";
  const supportsTemperature = modelId !== "o3-mini";

  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("provider", provider);
        fd.set("modelId", modelId);
        fd.set("engine", engine);
        if (isEdit && bot) {
          fd.set("id", bot.id);
          // The slug input is disabled in edit mode; disabled inputs
          // never appear in FormData, so re-inject it here from the
          // bot row so the patch schema's slug regex passes.
          fd.set("slug", bot.slug);
        }
        start(async () => {
          const action = isEdit ? updateChatbotAction : createChatbotAction;
          const result = (await action(fd)) as { error?: string; ok?: true } | undefined;
          if (result && "error" in result && result.error) setError(result.error);
          else if (isEdit) router.refresh();
        });
      }}
      className="flex flex-col gap-6"
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Slug" hint="lowercase-kebab-case; stable identifier in URLs">
          <input
            name="slug"
            required
            defaultValue={bot?.slug ?? ""}
            disabled={isEdit}
            className="input"
            pattern="[a-z0-9-]{3,64}"
          />
        </Field>
        <Field label="Name">
          <input name="name" required defaultValue={bot?.name ?? ""} className="input" />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          rows={2}
          defaultValue={bot?.description ?? ""}
          className="input"
        />
      </Field>

      <Field
        label="Engine"
        hint="ai_sdk = Vercel AI SDK abstraction (current default). Direct engines bypass the SDK and call the official provider SDK; provider locks to match."
      >
        <select
          value={engine}
          onChange={(e) => onEngineChange(e.target.value as Engine)}
          className="input"
        >
          {ENGINES.map((e) => (
            <option key={e} value={e}>
              {e === "ai_sdk"
                ? "ai_sdk · Vercel AI SDK (default)"
                : e === "anthropic_direct"
                  ? "anthropic_direct · @anthropic-ai/sdk"
                  : "openai_direct · openai SDK"}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Provider">
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as AiProvider)}
            className="input"
            disabled={engine === "anthropic_direct" || engine === "openai_direct"}
          >
            {AI_PROVIDERS.map((p) => {
              const configured = availableProviders.includes(p);
              return (
                <option key={p} value={p}>
                  {p}
                  {configured ? "" : " (no API key set)"}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Model">
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value as ModelId)}
            className="input"
          >
            {MODEL_BY_PROVIDER[provider].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Field
          label="Temperature"
          hint={supportsTemperature ? "0.0 – 2.0" : "Not supported by o3-mini"}
        >
          <input
            type="number"
            step="0.05"
            min={0}
            max={2}
            name="temperature"
            defaultValue={bot?.temperature ?? 0.3}
            className="input"
            disabled={!supportsTemperature}
          />
        </Field>
        <Field label="Max tokens" hint="blank = provider default">
          <input
            type="number"
            min={1}
            name="maxTokens"
            defaultValue={bot?.maxTokens ?? ""}
            className="input"
          />
        </Field>
        <Field label="Max steps" hint="tool-use budget per turn">
          <input
            type="number"
            min={1}
            max={10}
            name="maxSteps"
            defaultValue={bot?.maxSteps ?? 3}
            className="input"
          />
        </Field>
      </div>

      <Field label="System prompt">
        <textarea
          name="systemPrompt"
          rows={10}
          required
          defaultValue={bot?.systemPrompt ?? ""}
          className="input font-mono text-[13px]"
        />
      </Field>

      <Field label="Tools">
        <div className="grid gap-2 md:grid-cols-2">
          {TOOL_IDS.map((t) => {
            const meta = TOOL_META_BY_ID[t];
            return (
              <label
                key={t}
                className="flex items-start gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="tools"
                  value={t}
                  defaultChecked={bot?.tools.includes(t) ?? false}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium">
                    {t}
                    {meta?.costClass && (
                      <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                        {meta.costClass}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-600">{meta?.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="Allowed roles" hint="Empty = any authenticated user">
        <div className="flex flex-wrap gap-3">
          {USER_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="allowedRoles"
                value={r}
                defaultChecked={bot?.allowedRoles.includes(r) ?? false}
              />
              {r}
            </label>
          ))}
        </div>
      </Field>

      <div className="grid gap-6 md:grid-cols-3">
        <Field label="Rate-limit tokens">
          <input
            type="number"
            min={1}
            name="rateLimitTokens"
            defaultValue={bot?.rateLimitTokens ?? 20}
            className="input"
          />
        </Field>
        <Field label="Window">
          <select
            name="rateLimitWindow"
            defaultValue={bot?.rateLimitWindow ?? "1 h"}
            className="input"
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Daily cost cap (USD)" hint="0 = unlimited">
          <input
            type="number"
            step="0.01"
            min={0}
            name="dailyCostCapUsd"
            defaultValue={bot?.dailyCostCapUsd ?? 0}
            className="input"
          />
        </Field>
      </div>

      {/* Hidden + checkbox pattern: unchecked browsers omit the
          checkbox entirely from FormData, so the server can't tell
          "user unchecked it" from "field never rendered" — and a
          stale form save would silently disable the bot. The hidden
          field always submits "false"; the checkbox (when checked)
          submits "true" with the same name. The action picks the
          last value. */}
      <label className="flex items-center gap-2 text-sm">
        <input type="hidden" name="enabled" value="false" />
        <input
          type="checkbox"
          name="enabled"
          value="true"
          defaultChecked={bot?.enabled ?? true}
        />
        Enabled
      </label>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create chatbot"}
        </button>

        {isEdit && bot && (
          // Plain button (NOT a nested form — React 19 throws a
          // hydration error on form-in-form). We construct FormData
          // ourselves and invoke the server action via the click
          // handler so the outer save form stays the only <form>.
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete "${bot.name}"? This soft-deletes the bot.`)) return;
              const fd = new FormData();
              fd.set("id", bot.id);
              start(async () => {
                const res = (await deleteChatbotAction(fd)) as
                  | { ok?: true; error?: string }
                  | undefined;
                if (res && "error" in res && res.error) setError(res.error);
                else router.push("/admin/chatbots");
              });
            }}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid rgb(212 212 212);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          background: white;
        }
        .input:focus {
          border-color: rgb(23 23 23);
        }
        .input:disabled {
          background: rgb(245 245 245);
          color: rgb(115 115 115);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}
