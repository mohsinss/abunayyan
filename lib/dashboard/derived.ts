import { departments, entities, matrix } from "./data";
import type { Entity, MatrixCell } from "./types";

export function findEntity(id: string): Entity | undefined {
  return entities.find((e) => e.id === id);
}

export function entityById(id: string): Entity {
  const e = findEntity(id);
  if (!e) throw new Error(`Unknown entity id: ${id}`);
  return e;
}

export function entitiesRankedByScore(): Entity[] {
  return [...entities].sort((a, b) => a.compositeScore - b.compositeScore);
}

export function entitiesRankedByScoreDesc(): Entity[] {
  return [...entities].sort((a, b) => b.compositeScore - a.compositeScore);
}

export function totalRevenue(): number {
  return entities.reduce((sum, e) => sum + e.revenue, 0);
}

export function totalOpProfit(): number {
  return entities.reduce((sum, e) => sum + e.opProfit, 0);
}

export function totalSla(): number {
  return entities.reduce((sum, e) => sum + e.slaCost, 0);
}

export function totalBudget(): number {
  return departments.reduce((sum, d) => sum + d.budget, 0);
}

export function matrixCellsForEntity(entityId: string): MatrixCell[] {
  return matrix.filter((c) => c.entityId === entityId);
}

export function matrixCellsForDepartment(deptId: string): MatrixCell[] {
  return matrix.filter((c) => c.departmentId === deptId);
}

export function matrixRowTotal(deptId: string): number {
  return matrixCellsForDepartment(deptId).reduce((s, c) => s + c.amount, 0);
}

export function matrixColumnTotal(entityId: string): number {
  return matrixCellsForEntity(entityId).reduce((s, c) => s + c.amount, 0);
}

export interface MatrixRowInfo {
  deptId: string;
  name: string;
  budget: number;
  cells: Record<string, number>;
  total: number;
}

// Matrix display rows: the 8 explicit departments from the mockup + "other"
// which aggregates the remaining seven smaller functions (11.3M).
export const MATRIX_ROW_DEFS: Array<{ id: string; label: string; budget: number }> = [
  { id: "ict", label: "ICT", budget: 56_600_000 },
  { id: "hr", label: "HR", budget: 16_200_000 },
  { id: "strategy", label: "Strategy", budget: 14_200_000 },
  { id: "bd-mkt", label: "BD & MKT", budget: 12_900_000 },
  { id: "legal", label: "Legal", budget: 7_100_000 },
  { id: "treasury", label: "Treasury", budget: 4_900_000 },
  { id: "audit", label: "Internal Audit", budget: 9_500_000 },
  { id: "epmo", label: "EPMO", budget: 7_400_000 },
  { id: "other", label: "Other (7 depts)", budget: 11_300_000 },
];

export function matrixRows(): MatrixRowInfo[] {
  return MATRIX_ROW_DEFS.map(({ id, label, budget }) => {
    const cells: Record<string, number> = {};
    let total = 0;
    for (const c of matrixCellsForDepartment(id)) {
      cells[c.entityId] = c.amount;
      total += c.amount;
    }
    return { deptId: id, name: label, budget, cells, total };
  });
}

// Min/max amount across the matrix — used to normalize heatmap intensity.
export function matrixRange(): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const c of matrix) {
    if (c.amount > 0 && c.amount < min) min = c.amount;
    if (c.amount > max) max = c.amount;
  }
  return { min: min === Number.POSITIVE_INFINITY ? 0 : min, max };
}

export function formatSAR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function formatFullSAR(n: number): string {
  const isNeg = n < 0;
  const s = Math.abs(n).toLocaleString();
  return isNeg ? `(${s})` : s;
}

export function formatPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
