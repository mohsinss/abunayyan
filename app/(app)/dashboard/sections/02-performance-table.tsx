"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { entities, EXCLUDED_NOTE } from "@/lib/dashboard/data";
import { formatFullSAR, formatPct, formatSAR } from "@/lib/dashboard/derived";
import { tierOrder, tierMeta } from "@/lib/dashboard/tokens";
import type { Entity, Tier } from "@/lib/dashboard/types";
import { Card, FilterNote, SectionShell } from "@/components/dashboard/section-shell";
import { EntityChip } from "@/components/dashboard/entity-chip";
import { TierBadge } from "@/components/dashboard/tier-badge";
import { FilterChips, Toolbar } from "@/components/dashboard/chart-controls";
import { useSelectedEntity } from "@/components/dashboard/selected-entity-provider";

function cellClass(val: number, thresholds: { warn?: number; critical?: number; negative?: boolean }) {
  if (thresholds.negative && val < 0) return "text-atlas-alert font-semibold";
  if (thresholds.critical !== undefined && val >= thresholds.critical)
    return "text-atlas-alert font-semibold";
  if (thresholds.warn !== undefined && val >= thresholds.warn) return "text-atlas-warn font-semibold";
  return "";
}

export function PerformanceTableSection() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "compositeScore", desc: true }]);
  const [enabledTiers, setEnabledTiers] = useState<Tier[]>([...tierOrder]);
  const [nameFilter, setNameFilter] = useState("");
  const { isActive } = useSelectedEntity();

  const filteredData = useMemo(
    () =>
      entities.filter(
        (e) =>
          enabledTiers.includes(e.tier) &&
          (nameFilter === "" || e.name.toLowerCase().includes(nameFilter.toLowerCase())),
      ),
    [enabledTiers, nameFilter],
  );

  const columns = useMemo<ColumnDef<Entity>[]>(
    () => [
      {
        id: "name",
        header: "Entity",
        accessorKey: "name",
        cell: ({ row }) => (
          <EntityChip
            id={row.original.id}
            name={row.original.name}
            isJV={row.original.isJV}
            className="text-[13px]"
          />
        ),
      },
      {
        id: "revenue",
        accessorKey: "revenue",
        header: () => <span>Revenue</span>,
        cell: ({ getValue }) => formatFullSAR(getValue<number>()),
      },
      {
        id: "opProfit",
        accessorKey: "opProfit",
        header: "Op. Profit",
        cell: ({ getValue }) => formatFullSAR(getValue<number>()),
      },
      {
        id: "opMargin",
        accessorKey: "opMargin",
        header: "Op. Margin",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return (
            <span className={cellClass(v, { warn: 0.06, critical: 0.04 }) || (v >= 0.1 ? "text-atlas-ok" : "")}>
              {formatPct(v)}
            </span>
          );
        },
      },
      {
        id: "slaCost",
        accessorKey: "slaCost",
        header: "SLA Cost",
        cell: ({ getValue }) => formatFullSAR(getValue<number>()),
      },
      {
        id: "slaToRevenue",
        accessorKey: "slaToRevenue",
        header: "SLA / Rev",
        cell: ({ getValue }) => formatPct(getValue<number>(), 2),
      },
      {
        id: "slaToOpProfit",
        accessorKey: "slaToOpProfit",
        header: "SLA / OpP",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return (
            <span className={cellClass(v, { warn: 0.35, critical: 0.5 })}>{formatPct(v)}</span>
          );
        },
      },
      {
        id: "slaToPL",
        accessorKey: "slaToPL",
        header: "SLA / P&L",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className={cellClass(v, { warn: 0.4, critical: 0.55 })}>{formatPct(v)}</span>;
        },
      },
      {
        id: "opProfitPostSla",
        accessorKey: "opProfitPostSla",
        header: "OpP post-SLA",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return (
            <span className={cellClass(v, { negative: true })}>
              {v < 0 ? `(${formatFullSAR(Math.abs(v))})` : formatFullSAR(v)}
            </span>
          );
        },
      },
      {
        id: "plPostSla",
        accessorKey: "plPostSla",
        header: "P&L post-SLA",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return (
            <span className={cellClass(v, { negative: true })}>
              {v < 0 ? `(${formatFullSAR(Math.abs(v))})` : formatFullSAR(v)}
            </span>
          );
        },
      },
      {
        id: "headcount",
        accessorKey: "headcount",
        header: "Headcount",
        cell: ({ getValue }) => getValue<number>().toLocaleString(),
      },
      {
        id: "revPerEmployee",
        accessorKey: "revPerEmployee",
        header: "Rev / Emp",
        cell: ({ getValue }) => formatSAR(getValue<number>()),
      },
      {
        id: "slaPerEmployee",
        accessorKey: "slaPerEmployee",
        header: "SLA / Emp",
        cell: ({ getValue }) => formatSAR(getValue<number>()),
      },
      {
        id: "compositeScore",
        accessorKey: "compositeScore",
        header: "Score",
        cell: ({ getValue }) => getValue<number>().toFixed(1),
      },
      {
        id: "tier",
        accessorKey: "tier",
        header: "Tier",
        cell: ({ getValue }) => <TierBadge tier={getValue<Tier>()} />,
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const toggleTier = (t: Tier) => {
    setEnabledTiers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  return (
    <SectionShell
      id="performance"
      num="02"
      title={
        <>
          Full Performance <em className="italic text-atlas-gold">Table</em>
        </>
      }
      description="Fourteen metrics · click any header to sort"
    >
      <Card
        title="Comprehensive financial and operational indicators"
        subtitle="FY2026 (B) · figures in SAR · K = thousand, M = million, B = billion"
      >
        <Toolbar>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Filter entity name…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="rounded-sm border border-atlas-line bg-atlas-bg-2 px-3 py-1.5 font-mono text-[11px] text-atlas-ink outline-none placeholder:text-atlas-ink-3 focus:border-atlas-gold"
            />
            <span className="font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink-3">
              {filteredData.length} / {entities.length} rows
            </span>
          </div>
          <FilterChips
            label="Tier"
            values={enabledTiers}
            onToggle={toggleTier}
            options={tierOrder.map((t) => ({
              value: t,
              label: tierMeta[t].label,
              dot: tierMeta[t].color,
            }))}
          />
        </Toolbar>

        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header, i) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    const align = i === 0 ? "text-left" : "text-right";
                    return (
                      <th
                        key={header.id}
                        className={`sticky top-0 whitespace-nowrap border-b-2 border-atlas-ink bg-atlas-bg-2 px-2 py-3 font-medium uppercase tracking-[1.2px] text-atlas-ink-3 text-[9px] ${align}`}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={`inline-flex items-center gap-1 hover:text-atlas-ink ${i !== 0 ? "flex-row-reverse" : ""}`}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === "asc" ? (
                              <ArrowUp className="size-3 text-atlas-gold" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3 text-atlas-gold" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const active = isActive(row.original.id);
                return (
                  <tr
                    key={row.id}
                    id={`entity-row-${row.original.id}`}
                    className={`transition-colors ${active ? "bg-atlas-gold-soft" : "hover:bg-atlas-bg-3"}`}
                  >
                    {row.getVisibleCells().map((cell, i) => {
                      const align =
                        i === 0
                          ? "text-left font-sans text-[13px] font-medium text-atlas-ink"
                          : i === row.getVisibleCells().length - 1
                            ? "text-right"
                            : "text-right tabular-nums text-atlas-ink-2";
                      return (
                        <td
                          key={cell.id}
                          className={`whitespace-nowrap border-b border-atlas-line px-2 py-2.5 ${align}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <FilterNote>
          <strong className="text-atlas-ink">Excluded from operating universe:</strong> {EXCLUDED_NOTE.replace("Excluded from operating universe: ", "")}
        </FilterNote>
      </Card>
    </SectionShell>
  );
}
