"use client";

import { useMemo, useState } from "react";
import { diffCounts, diffLines } from "@/lib/text/diff";

type PromptVersion = {
  id: string;
  version: number;
  systemPrompt: string;
  note: string | null;
  createdAt: Date;
};

export function PromptDiffPanel({
  history,
  activeVersion,
}: {
  history: PromptVersion[];
  activeVersion: number;
}) {
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.version - a.version),
    [history],
  );
  const versions = sorted.map((p) => p.version);

  // Default: compare the two most recent versions, or the active vs the one
  // before it when available.
  const defaultTo = activeVersion;
  const defaultFrom = versions.find((v) => v < activeVersion) ?? activeVersion;

  const [fromV, setFromV] = useState<number>(defaultFrom);
  const [toV, setToV] = useState<number>(defaultTo);
  const [onlyChanges, setOnlyChanges] = useState(false);

  const fromRow = sorted.find((p) => p.version === fromV);
  const toRow = sorted.find((p) => p.version === toV);

  const diff = useMemo(() => {
    if (!fromRow || !toRow) return [];
    return diffLines(fromRow.systemPrompt, toRow.systemPrompt);
  }, [fromRow, toRow]);

  const counts = useMemo(() => diffCounts(diff), [diff]);
  const unchanged = sorted.length < 2 || fromV === toV;

  return (
    <div className="rounded-md border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            From
          </span>
          <select
            value={fromV}
            onChange={(e) => setFromV(Number(e.target.value))}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            {versions.map((v) => (
              <option key={v} value={v}>
                v{v}
                {v === activeVersion ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            To
          </span>
          <select
            value={toV}
            onChange={(e) => setToV(Number(e.target.value))}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            {versions.map((v) => (
              <option key={v} value={v}>
                v{v}
                {v === activeVersion ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs">
          {!unchanged && (
            <>
              <span className="font-mono text-emerald-700">+{counts.added}</span>
              <span className="font-mono text-red-700">−{counts.deleted}</span>
            </>
          )}
          <label className="flex items-center gap-1.5 text-neutral-700">
            <input
              type="checkbox"
              checked={onlyChanges}
              onChange={(e) => setOnlyChanges(e.target.checked)}
            />
            Only changes
          </label>
        </div>
      </div>

      {unchanged ? (
        <div className="px-4 py-8 text-center text-sm text-neutral-500">
          Pick two different versions to see the diff.
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-auto bg-neutral-50 px-0 py-2 font-mono text-[12px] leading-relaxed">
          {diff
            .filter((row) => !onlyChanges || row.kind !== "same")
            .map((row, i) => (
              <DiffRow key={i} row={row} />
            ))}
        </div>
      )}
    </div>
  );
}

function DiffRow({
  row,
}: {
  row: { kind: "same" | "add" | "del"; line: string; oldLineNo?: number; newLineNo?: number };
}) {
  const bg =
    row.kind === "add"
      ? "bg-emerald-50"
      : row.kind === "del"
        ? "bg-red-50"
        : "bg-transparent";
  const marker =
    row.kind === "add" ? "+" : row.kind === "del" ? "−" : " ";
  const markerColor =
    row.kind === "add"
      ? "text-emerald-700"
      : row.kind === "del"
        ? "text-red-700"
        : "text-neutral-400";

  return (
    <div className={`flex gap-2 px-3 ${bg}`}>
      <span className="w-8 shrink-0 select-none text-right text-neutral-400">
        {row.oldLineNo ?? ""}
      </span>
      <span className="w-8 shrink-0 select-none text-right text-neutral-400">
        {row.newLineNo ?? ""}
      </span>
      <span className={`w-4 shrink-0 select-none ${markerColor}`}>{marker}</span>
      <span className="whitespace-pre-wrap break-all text-neutral-900">
        {row.line || " "}
      </span>
    </div>
  );
}
