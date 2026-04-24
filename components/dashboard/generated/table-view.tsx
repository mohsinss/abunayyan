"use client";

import { useMemo, useState } from "react";
import type { ProposedColumn } from "@/lib/datasets/proposer";

export function TableView({
  columns,
  rows,
  pageSize = 25,
}: {
  title: string;
  columns: ProposedColumn[];
  rows: Array<Record<string, unknown>>;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [rows, page, pageSize],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-atlas-ink-3">
          {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"} · {columns.length} cols
        </span>
        {pages > 1 ? (
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[1.2px]">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-atlas-ink-3 transition-colors hover:text-atlas-gold disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-atlas-ink-2">
              Page {page + 1} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="text-atlas-ink-3 transition-colors hover:text-atlas-gold disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-sm border border-atlas-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-atlas-line bg-atlas-bg-3 text-left">
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="whitespace-nowrap px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[1.2px] text-atlas-ink-3"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-atlas-line/60 transition-colors last:border-b-0 hover:bg-atlas-gold-soft/40"
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={`whitespace-nowrap px-3 py-2 font-sans text-atlas-ink ${
                      c.type === "number" || c.type === "integer" ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {formatCell(r[c.id])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink-3"
                >
                  No rows.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number")
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(v);
  return String(v);
}
