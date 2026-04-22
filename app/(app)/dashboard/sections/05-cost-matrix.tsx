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
type ScopeMode = "row" | "matrix";

// All three scale modes ignore zero/empty cells when computing the
// normalization bounds — a missing allocation shouldn't pull the ramp.
// Uniform non-zero rows (e.g. Strategy: every cell = 810) collapse to
// a mid-scale color instead of painting everything red.
function intensityLinear(amount: number, min: number, max: number) {
  if (amount <= 0) return 0;
  if (max <= min) return 0.5;
  return Math.min(Math.max((amount - min) / (max - min), 0), 1);
}

function intensityLog(amount: number, min: number, max: number) {
  if (amount <= 0) return 0;
  if (max <= min) return 0.5;
  const la = Math.log10(amount + 1);
  const lo = Math.log10(min + 1);
  const hi = Math.log10(max + 1);
  return Math.min(Math.max((la - lo) / (hi - lo), 0), 1);
}

function intensityQuantile(amount: number, sorted: number[]) {
  if (amount <= 0 || sorted.length === 0) return 0;
  if (sorted.length === 1) return 0.5;
  const rank = sorted.findIndex((v) => v >= amount);
  return rank === -1 ? 1 : rank / Math.max(sorted.length - 1, 1);
}

// Diverging green → lime → yellow → orange → red scale.
// Alpha scales with intensity so small allocations fade into the
// background and large ones saturate — restoring the depth the
// original single-tone heatmap had, just with hue semantics layered
// on top. Curve is sqrt() so the mid/upper range fills out more of
// the palette instead of everything clustering in pale green.
function intensityToColor(t: number): string {
  const raw = Math.max(0, Math.min(1, t));
  const k = Math.sqrt(raw); // pull mid-range values toward the colorful end
  let h: number;
  let s: number;
  let l: number;
  if (k <= 0.5) {
    const a = k * 2;
    h = 110 - a * 60; // 110 (green) → 50 (yellow)
    s = 55 + a * 25; // 55% → 80%
    l = 65 - a * 10; // 65% → 55%
  } else {
    const a = (k - 0.5) * 2;
    h = 50 - a * 45; // 50 (yellow) → 5 (red)
    s = 80 + a * 10; // 80% → 90%
    l = 55 - a * 15; // 55% → 40%
  }
  const alpha = 0.25 + k * 0.75; // 0.25 floor so tiny cells still read, 1.0 ceiling
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

function textColorFor(t: number): string {
  // White text once the background is deep enough that dark ink loses contrast.
  return Math.sqrt(t) > 0.68 ? "#ffffff" : "var(--atlas-ink)";
}

export function CostMatrixSection() {
  const [columnSort, setColumnSort] = useState<ColumnSort>("alpha");
  const [rowSort, setRowSort] = useState<RowSort>("budget");
  const [scale, setScale] = useState<ScaleMode>("linear");
  const [scope, setScope] = useState<ScopeMode>("row");
  const { hoveredId, hoverEntity, selectEntity, isActive } = useSelectedEntity();
  const [hoverDept, setHoverDept] = useState<string | null>(null);

  const { min: matrixMin, max: matrixMax } = matrixRange();
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

  // Intensity is computed against either the whole matrix (scope=matrix)
  // or just the current row (scope=row). Per-row scope lets each department's
  // color gradient tell its own story — a 500 SAR cell in Treasury's 4.9M
  // budget reads as "hot" for that row even though it's cool against ICT.
  // Zero/empty cells are excluded from min/max and from the quantile ranks.
  function intensityFor(
    amount: number,
    rowMin: number,
    rowMax: number,
    rowSorted: number[],
  ): number {
    if (amount <= 0) return 0;
    if (scope === "row") {
      if (scale === "linear") return intensityLinear(amount, rowMin, rowMax);
      if (scale === "log") return intensityLog(amount, rowMin, rowMax);
      return intensityQuantile(amount, rowSorted);
    }
    if (scale === "linear") return intensityLinear(amount, matrixMin, matrixMax);
    if (scale === "log") return intensityLog(amount, matrixMin, matrixMax);
    return intensityQuantile(amount, allAmounts);
  }

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
        subtitle="Green = light SLA burden · red = heavy burden · values in thousand SAR"
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
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Scope"
              value={scope}
              onChange={setScope}
              options={[
                { value: "row", label: "Per row" },
                { value: "matrix", label: "Matrix" },
              ]}
            />
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
          </div>
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
                const rowValues = Object.values(r.cells).filter((v) => v > 0);
                const rowMax = rowValues.length ? Math.max(...rowValues) : 0;
                const rowMin = rowValues.length ? Math.min(...rowValues) : 0;
                const rowSorted = [...rowValues].sort((a, b) => a - b);
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
                      const t = intensityFor(amount, rowMin, rowMax, rowSorted);
                      const colActive =
                        hoveredId === c.id || isActive(c.id) || deptHighlight;
                      const bg = amount > 0 ? intensityToColor(t) : "transparent";
                      const fg = amount > 0 ? textColorFor(t) : "var(--atlas-ink-4)";
                      return (
                        <td
                          key={c.id}
                          className="border-b border-atlas-line px-2 py-2.5 text-right font-medium tabular-nums transition-all"
                          style={{
                            backgroundColor: bg,
                            color: fg,
                            outline:
                              colActive && amount > 0
                                ? "2px solid var(--atlas-ink)"
                                : "none",
                            outlineOffset: colActive && amount > 0 ? "-2px" : "0",
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
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-dashed border-atlas-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-mono text-[9px] uppercase tracking-[1.2px] text-atlas-ink-3">
            Values in thousand SAR · {scope === "row" ? "each row has its own color scale" : "shared scale across the whole matrix"}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-atlas-ink-3">
              Low
            </span>
            <div
              className="h-3 w-56 rounded-full border border-atlas-line"
              style={{
                background: `linear-gradient(to right, ${intensityToColor(0)} 0%, ${intensityToColor(0.25)} 25%, ${intensityToColor(0.5)} 50%, ${intensityToColor(0.75)} 75%, ${intensityToColor(1)} 100%)`,
              }}
            />
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-atlas-ink-3">
              High
            </span>
          </div>
        </div>
      </Card>
    </SectionShell>
  );
}
