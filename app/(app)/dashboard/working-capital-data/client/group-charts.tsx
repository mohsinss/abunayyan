"use client";

import { nwcOf, type SbuShape } from "@/lib/working-capital-data/derive";
import type { SbuRow } from "../types";
import styles from "../styles.module.css";
import { useChart } from "./use-chart";

export function GroupCharts({
  sbus,
  cur,
  baselines,
}: {
  sbus: SbuRow[];
  cur: Record<string, SbuShape>;
  baselines: Record<string, SbuShape>;
}) {
  return (
    <div className={styles.dualGrid}>
      <div className={styles.panel}>
        <h3>NWC contribution by SBU</h3>
        <div className="sub">Stacked components — current vs adjusted</div>
        <div className={styles.chartWrapBig}>
          <GroupNwcChart sbus={sbus} cur={cur} />
        </div>
      </div>
      <div className={styles.panel}>
        <h3>CCC by SBU (days)</h3>
        <div className="sub">Baseline vs adjusted, sorted</div>
        <div className={styles.chartWrapBig}>
          <GroupCccChart sbus={sbus} cur={cur} baselines={baselines} />
        </div>
      </div>
    </div>
  );
}

// Stacked bar: per-SBU Inv / AR / CA / -AP. The HTML renders this with
// adjusted values; we keep it simple and show the current (cur) snapshot
// stacked, with NWC label totals via tooltip.
function GroupNwcChart({ sbus, cur }: { sbus: SbuRow[]; cur: Record<string, SbuShape> }) {
  const labels = sbus.map((s) => s.name);
  const get = (k: keyof SbuShape) => sbus.map((s) => (cur[s.key]?.[k] ?? s[k]) as number);
  const ref = useChart({
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Inventory", data: get("inv"), backgroundColor: "#0b3378", stack: "nwc" },
        { label: "AR", data: get("ar"), backgroundColor: "#2964a9", stack: "nwc" },
        { label: "Contract Assets", data: get("ca"), backgroundColor: "#418cc0", stack: "nwc" },
        {
          label: "AP (negative)",
          data: get("ap").map((v) => -v),
          backgroundColor: "#c98a2b",
          stack: "nwc",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label ?? ""}: ${Math.round(Math.abs(ctx.parsed.y as number))} SAR m`,
            afterTitle: (items) => {
              const i = items[0]?.dataIndex ?? 0;
              const s = sbus[i];
              if (!s) return "";
              const c = cur[s.key] ?? {
                inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap,
                dio: s.dio, dso: s.dso, dpo: s.dpo,
              };
              return `NWC ${Math.round(nwcOf(c))} SAR m`;
            },
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: "rgba(11,51,120,.06)" } },
      },
    },
  });
  return <canvas ref={ref} />;
}

function GroupCccChart({
  sbus,
  cur,
  baselines,
}: {
  sbus: SbuRow[];
  cur: Record<string, SbuShape>;
  baselines: Record<string, SbuShape>;
}) {
  // Sort by adjusted CCC descending (longest cycle first), STCL clipped
  // for readability since it dominates the axis.
  const rows = sbus
    .map((s) => {
      const c = cur[s.key] ?? baselines[s.key]!;
      const b = baselines[s.key]!;
      return {
        name: s.name,
        baseline: Math.min(b.dio + b.dso - b.dpo, 400),
        adjusted: Math.min(c.dio + c.dso - c.dpo, 400),
      };
    })
    .sort((a, b) => b.adjusted - a.adjusted);

  const ref = useChart({
    type: "bar",
    data: {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          label: "Baseline",
          data: rows.map((r) => r.baseline),
          backgroundColor: "#418cc0",
          borderRadius: 4,
        },
        {
          label: "Adjusted",
          data: rows.map((r) => r.adjusted),
          backgroundColor: "#0b3378",
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label ?? ""}: ${Math.round(ctx.parsed.x as number)} days (clipped at 400)`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 400,
          grid: { color: "rgba(11,51,120,.06)" },
          ticks: { font: { size: 10 } },
        },
        y: { grid: { display: false } },
      },
    },
  });
  return <canvas ref={ref} />;
}
