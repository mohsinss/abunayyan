"use client";

import { useState } from "react";

type Result = { archivedTotal: number; pruned: number; batches: number };

export function ArchivalPanel() {
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch("/api/v1/admin/archival/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setErr(body.message ?? `${res.status} ${res.statusText}`);
        return;
      }
      const body = (await res.json()) as Result;
      setLast(body);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-md border border-neutral-200 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Archival + retention
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Archives messages in threads untouched for 180+ days into{" "}
        <code className="rounded bg-neutral-100 px-1">messages_archive</code> (cold
        storage), then hard-deletes soft-deleted threads older than the retention
        window. Normally run nightly via QStash;{" "}
        <strong>Run now</strong> is a manual escape hatch.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {running ? "Running…" : "Run archival sweep now"}
        </button>
        {last && (
          <span className="font-mono text-xs text-neutral-600">
            archived <strong className="text-neutral-900">{last.archivedTotal}</strong>
            {" · "}
            pruned <strong className="text-neutral-900">{last.pruned}</strong>
            {" · "}
            batches <strong className="text-neutral-900">{last.batches}</strong>
          </span>
        )}
      </div>
      {err && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
    </section>
  );
}
