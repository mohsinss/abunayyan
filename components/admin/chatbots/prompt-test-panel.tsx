"use client";

import { useState } from "react";

export function PromptTestPanel({ botId }: { botId: string }) {
  const [msg, setMsg] = useState("Reply with exactly: OK");
  const [resp, setResp] = useState<{ text: string; usage?: { promptTokens?: number; completionTokens?: number } } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setErr(null);
    setResp(null);
    try {
      const r = await fetch(`/api/v1/admin/chatbots/${botId}/prompts/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userMessage: msg }),
      });
      if (!r.ok) {
        setErr(`${r.status} ${r.statusText}`);
        return;
      }
      const j = await r.json();
      setResp(j);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-neutral-200 p-4">
      <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        User message
      </label>
      <textarea
        rows={2}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send one-off test"}
        </button>
        <span className="text-xs text-neutral-500">
          Not persisted. Uses current saved prompt.
        </span>
      </div>
      {err && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
      {resp && (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <div className="mb-2 font-mono text-xs text-neutral-500">
            in {resp.usage?.promptTokens ?? "?"} / out {resp.usage?.completionTokens ?? "?"}
          </div>
          <div className="whitespace-pre-wrap">{resp.text}</div>
        </div>
      )}
    </div>
  );
}
