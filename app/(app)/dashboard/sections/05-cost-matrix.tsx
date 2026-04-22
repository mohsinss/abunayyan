"use client";

import { useMemo, useState } from "react";
import { entities } from "@/lib/dashboard/data";
import { formatSAR, matrixRange, matrixRows } from "@/lib/dashboard/derived";
import { Card, SectionShell } from "@/components/dashboard/section-shell";
import { Segmented, Toolbar } from "@/components/dashboard/chart-controls";
import {
  scrollToEntityRow,
  useSelectedEntity,
} from "@/components/dashboard/selected-entity-provider";

type ColumnSort = "total" | "alpha" | "score";
type RowSort = "budget" | "allocation" | "alpha";
type ScaleMode = "linear" | "quantile" | "log";

function intensityLinear(amount: number, max: number) {
  if (amount <= 0) return 0;
  return Math.min(amount / max, 1);
}

function intensityLog(amount: number, max: number) {
  if (amount <= 0) return 0;
  return Math.min(Math.log10(amount + 1) / Math.log10(max + 1), 1);
}

function intensityQuantile(amount: number, sorted: number[]) {
  if (amount <= 0) return 0;
  const rank = sorted.findIndex((v) => v >= amount);
  return rank === -1 ? 1 : rank / Math.max(sorted.length - 1, 1);
}

export function CostMatrixSection() {
  const [columnSort, setColumnSort] = useState<ColumnSort>("alpha");
  const [rowSort, setRowSort] = useState<RowSort>("budget");
  const [scale, setScale] = useState<ScaleMode>("linear");
  const { hoveredId, hoverEntity, selectEntity, isActive } = useSelectedEntity();
  const [hoverDept, setHoverDept] = useState<string | null>(null);

  const { max } = matrixRange();
  const allAmounts = useMemo(() => {
    const rows = matrixRows();
    const values: number[] = [];
    rows.forEach((r) => Object.values(r.cells).forEach((v) => v > 0 && values.push(v)));
    return values.sort((a, b) => a - b);
  }, []);

  const rows = useMemo(() => {
    const base = matrixRows();
    const sortFns: Record<RowSort, (a: typeof base[0], b: typeof base[0]) => number> = {
      budget: (a, b) => b.budget - a.budget,
      allocation: (a, b) => b.total - a.total,
      alpha: (a, b) => a.name.localeCompare(b.name),
    };
    return [...base].sort(sortFns[rowSort]);
  }, [rowSort]);

  const columns = useMemo(() => {
    const cols = [...entities];
    if (columnSort === "alpha") cols.sort((a, b) => a.name.localeCompare(b.name));
    else if (columnSort === "score") cols.sort((a, b) => a.compositeScore - b.compositeScore);
    else {
      cols.sort((a, b) => {
        const sumA = rows.reduce((s, r) => s + (r.cells[a.id] || 0), 0);
        const sumB = rows.reduce((s, r) => s + (r.cells[b.id] || 0), 0);
        return sumB - sumA;
      });
    }
    return cols;
  }, [columnSort, rows]);

  const columnTotals = useMemo(() => {
    const t: Record<string, number> = {};
    columns.forEach((c) => {
      t[c.id] = rows.reduce((s, r) => s + (r.cells[c.id] || 0), 0);
    });
    return t;
  }, [columns, rows]);

  const intensity = (amount: number) =>
    scale === "linear"
      ? intensityLinear(amount, max)
      : scale === "log"
        ? intensityLog(amount, max)
        : intensityQuantile(amount, allAmounts);

  return (
    <SectionShell
      id="matrix"
      num="05"
      title={
        <>
          Department × SBU <em className="italic text-atlas-gold">Cost Matrix</em>
        </>
      }
      description="Where each entity spends · darker = higher allocation"
    >
      <Card
        title="Cross-departmental SLA allocation"
        subtitle="Values in SAR · hover a cell for details · click column header to select entity"
      >
        <Toolbar>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Rows"
              value={rowSort}
              onChange={setRowSort}
              options={[
                { value: "budget", label: "Budget" },
                { value: "allocation", label: "Allocated" },
                { value: "alpha", label: "A–Z" },
              ]}
            />
            <Segmented
              label="Cols"
              value={columnSort}
              onChange={setColumnSort}
              options={[
                { value: "alpha", label: "A–Z" },
                { value: "total", label: "Total" },
                { value: "score", label: "Score" },
              ]}
            />
          </div>
          <Segmented
            label="Scale"
            value={scale}
            onChange={setScale}
            options={[
              { value: "linear", label: "Linear" },
              { value: "quantile", label: "Quantile" },
              { value: "log", label: "Log" },
            ]}
          />
        </Toolbar>

        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr>
                <th className="border-b-2 border-atlas-ink bg-atlas-bg-2 px-3 py-3 text-left font-medium uppercase tracking-[0.8px] text-atlas-ink-3 text-[9px]">
                  HQ Department ↓ / SBU →
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    className={`min-w-[68px] border-b-2 border-atlas-ink bg-atlas-bg-2 px-2 py-3 text-right font-medium uppercase tracking-[0.8px] text-[9px] transition-colors ${
                      isActive(c.id) ? "text-atlas-gold" : "text-atlas-ink-3"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectEntity(c.id);
                        scrollToEntityRow(c.id);
                      }}
                      onMouseEnter={() => hoverEntity(c.id)}
                      onMouseLeave={() => hoverEntity(null)}
                      className="hover:text-atlas-gold"
                    >
                      {c.name.length > 8 ? `${c.name.slice(0, 7)}.` : c.name}
                    </button>
                  </th>
                ))}
                <th className="border-b-2 border-atlas-ink bg-atlas-bg-2 px-2 py-3 text-right font-medium uppercase tracking-[0.8px] text-atlas-ink text-[9px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const deptHighlight = hoverDept === r.deptId;
                return (
                  <tr
                    key={r.deptId}
                    onMouseEnter={() => setHoverDept(r.deptId)}
                    onMouseLeave={() => setHoverDept(null)}
                  >
                    <td
                      className={`border-b border-atlas-line px-3 py-2.5 text-left font-sans text-[12px] font-medium text-atlas-ink transition-colors ${
                        deptHighlight ? "bg-atlas-gold-soft" : ""
                      }`}
                    >
                      {r.name}
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-[1px] text-atlas-ink-3">
                        ({formatSAR(r.budget)})
                      </span>
                    </td>
                    {columns.map((c) => {
                      const amount = r.cells[c.id] || 0;
                      const alpha = intensity(amount);
                      const colActive =
                        hoveredId === c.id || isActive(c.id) || deptHighlight;
                      return (
                        <td
                          key={c.id}
                          className={`border-b border-atlas-line px-2 py-2.5 text-right tabular-nums transition-colors ${
                            amount === 0 ? "text-atlas-ink-4" : "text-atlas-ink"
                          }`}
                          style={{
                            backgroundColor:
                              amount > 0
                                ? `rgba(139, 111, 46, ${alpha * 0.55})`
                                : "transparent",
                            outline: colActive && amount > 0 ? "1px solid var(--atlas-gold)" : "none",
                          }}
                          title={`${r.name} → ${c.name}: ${amount.toLocaleString()} SAR`}
                        >
                          {amount === 0 ? "—" : `${(amount / 1000).toFixed(0)}`}
                        </td>
                      );
                    })}
                    <td className="border-b border-atlas-line bg-atlas-bg-3 px-2 py-2.5 text-right font-semibold text-atlas-ink">
                      {(r.total / 1000).toFixed(0)}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="border-t-2 border-atlas-ink bg-atlas-bg-3 px-3 py-3 text-left font-semibold text-atlas-ink">
                  TOTAL SLA
                </td>
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={`border-t-2 border-atlas-ink bg-atlas-bg-3 px-2 py-3 text-right font-semibold ${
                      isActive(c.id) ? "text-atlas-gold" : "text-atlas-ink"
                    }`}
                  >
                    {(columnTotals[c.id] / 1000).toFixed(0)}
                  </td>
                ))}
                <td className="border-t-2 border-atlas-ink bg-atlas-bg-3 px-2 py-3 text-right font-semibold text-atlas-ink">
                  {(Object.values(columnTotals).reduce((s, v) => s + v, 0) / 1000).toFixed(0)}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 font-mono text-[9px] uppercase tracking-[1px] text-atlas-ink-3">
            Cell values in thousand SAR (÷ 1,000). Intensity re-scales with the selector above.
          </div>
        </div>
      </Card>
    </SectionShell>
  );
}
