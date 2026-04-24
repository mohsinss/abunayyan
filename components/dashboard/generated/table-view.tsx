"use client";

import { useMemo, useState } from "react";
import type { ProposedColumn } from "@/lib/datasets/proposer";
import { Button } from "@/components/ui/button";

export function TableView({
  title,
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
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {columns.map((c) => (
                <th key={c.id} className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i} className="border-b border-border/60 hover:bg-muted/40">
                {columns.map((c) => (
                  <td key={c.id} className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {formatCell(r[c.id])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                  No rows.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <span className="text-muted-foreground">
            Page {page + 1} / {pages}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Prev
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>
            Next
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number") return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(v);
  return String(v);
}
