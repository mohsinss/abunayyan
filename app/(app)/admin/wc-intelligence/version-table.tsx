"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

type QaSummary = {
  unknownLabels: number;
  checksPassed: number;
  checksFailed: number;
  checksSkipped: number;
  failedChecks: Array<{ id: string; label: string; failures: number; total: number }>;
};

export type VersionRow = {
  id: string;
  filename: string;
  status: string;
  parseError: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  factsCount: number;
  recordsCount: number;
  isActive: boolean;
  createdAt: string;
  qa: QaSummary | null;
};

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  parsing: "bg-amber-50 text-amber-700 border-amber-200",
  queued: "bg-neutral-50 text-neutral-600 border-neutral-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export function VersionTable({ uploads }: { uploads: VersionRow[] }) {
  const router = useRouter();
  const [activating, setActivating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate(id: string) {
    setActivating(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/wcx/uploads/${id}/activate`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setActivating(null);
    }
  }

  if (uploads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
        No uploads yet. Upload the filled workbook above to create the first version.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {error && <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600">
          <tr>
            <th className="px-4 py-2 text-left">File</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Coverage</th>
            <th className="px-4 py-2 text-right">Facts</th>
            <th className="px-4 py-2 text-left">QA</th>
            <th className="px-4 py-2 text-right">Uploaded</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((u) => (
            <Row
              key={u.id}
              row={u}
              expanded={expanded === u.id}
              onToggle={() => setExpanded(expanded === u.id ? null : u.id)}
              activating={activating === u.id}
              onActivate={() => activate(u.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  row,
  expanded,
  onToggle,
  activating,
  onActivate,
}: {
  row: VersionRow;
  expanded: boolean;
  onToggle: () => void;
  activating: boolean;
  onActivate: () => void;
}) {
  return (
    <>
      <tr className="border-t border-neutral-100">
        <td className="px-4 py-2 font-medium">
          <button type="button" onClick={onToggle} className="flex items-center gap-1.5 text-left">
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {row.filename}
            {row.isActive && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="size-3" /> active
              </span>
            )}
          </button>
        </td>
        <td className="px-4 py-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[row.status] ?? STATUS_STYLES.queued}`}
          >
            {row.status}
          </span>
        </td>
        <td className="px-4 py-2 text-neutral-600 tabular-nums">
          {row.periodStart ? `${row.periodStart} → ${row.periodEnd}` : "—"}
        </td>
        <td className="px-4 py-2 text-right tabular-nums">
          {row.factsCount > 0 ? row.factsCount.toLocaleString() : "—"}
        </td>
        <td className="px-4 py-2 text-xs">
          {row.qa ? (
            <span>
              <b className="text-emerald-700">{row.qa.checksPassed} pass</b>
              {" · "}
              <b className={row.qa.checksFailed > 0 ? "text-red-600" : "text-neutral-500"}>
                {row.qa.checksFailed} fail
              </b>
              {" · "}
              <span className="text-neutral-500">{row.qa.checksSkipped} skip</span>
              {row.qa.unknownLabels > 0 && (
                <span className="text-amber-700"> · {row.qa.unknownLabels} unknown labels</span>
              )}
            </span>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </td>
        <td className="px-4 py-2 text-right text-xs text-neutral-500">
          {row.createdAt.slice(0, 16).replace("T", " ")}
        </td>
        <td className="px-4 py-2 text-right">
          {row.status === "ready" && !row.isActive && (
            <button
              type="button"
              onClick={onActivate}
              disabled={activating}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              {activating && <Loader2 className="size-3 animate-spin" />}
              Activate
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-neutral-100 bg-neutral-50/60">
          <td colSpan={7} className="px-6 py-3 text-xs text-neutral-700">
            {row.parseError && (
              <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                {row.parseError}
              </div>
            )}
            {row.qa ? (
              row.qa.failedChecks.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5">
                  {row.qa.failedChecks.map((c) => (
                    <li key={c.id}>
                      <b>{c.label}</b> — {c.failures.toLocaleString()} of {c.total.toLocaleString()}{" "}
                      cells off-tolerance
                    </li>
                  ))}
                </ul>
              ) : (
                <span>All reconciliation checks passed or were skipped (no calc cells present).</span>
              )
            ) : (
              <span>No QA report yet.</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
