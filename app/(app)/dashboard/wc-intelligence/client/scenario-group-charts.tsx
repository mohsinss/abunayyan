"use client";

import { nwcOf, type WcxLeverShape, type WcxScenarioBaseline } from "@/lib/wcx/scenario";
import styles from "../styles.module.css";
import { useChart } from "./use-chart";

// Live group charts for the scenario state — same layout as the original
// brief: stacked NWC components by SBU with current/baseline NWC trend
// lines, and CCC by SBU (baseline vs adjusted) as a sorted horizontal bar.
export function ScenarioGroupCharts({
  baselines,
  shapes,
}: {
  baselines: WcxScenarioBaseline[];
  shapes: Record<string, WcxLeverShape>;
}) {
  return (
    <div className={styles.dualGrid}>
      <div className={styles.panel}>
        <h3>NWC contribution by SBU</h3>
        <div className="sub">Stacked components — adjusted scenario vs latest actuals</div>
        <div className={styles.chartWrapBig}>
          <GroupNwcChart baselines={baselines} shapes={shapes} />
        </div>
      </div>
      <div className={styles.panel}>
        <h3>CCC by SBU (days)</h3>
        <div className="sub">Baseline vs adjusted, sorted</div>
        <div className={styles.chartWrapBig}>
          <GroupCccChart baselines={baselines} shapes={shapes} />
        </div>
      </div>
    </div>
  );
}

function GroupNwcChart({
  baselines,
  shapes,
}: {
  baselines: WcxScenarioBaseline[];
  shapes: Record<string, WcxLeverShape>;
}) {
  const labels = baselines.map((b) => b.code);
  const cur = baselines.map((b) => shapes[b.code] ?? b.shape);

  type DS = Record<string, unknown> & { data: number[] };
  const datasets: DS[] = [
    {
      type: "bar" as const,
      label: "Inventory",
      data: cur.map((s) => s.inv),
      backgroundColor: "#0b3378",
      stack: "nwc",
      order: 3,
    },
    {
      type: "bar" as const,
      label: "AR + Contract",
      data: cur.map((s) => s.ar + s.ca),
      backgroundColor: "#418cc0",
      stack: "nwc",
      order: 3,
    },
    {
      type: "bar" as const,
      label: "Payables (–)",
      data: cur.map((s) => -s.ap),
      backgroundColor: "#7f7f7f",
      stack: "nwc",
      order: 3,
    },
    {
      type: "line" as const,
      label: "NWC (current)",
      data: cur.map(nwcOf),
      borderColor: "#2964a9",
      backgroundColor: "#2964a9",
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 3,
      pointBackgroundColor: "#2964a9",
      pointBorderColor: "#fff",
      pointBorderWidth: 1,
      order: 0,
    } as DS,
    {
      type: "line" as const,
      label: "NWC (baseline)",
      data: baselines.map((b) => nwcOf(b.shape)),
      borderColor: "#c98a2b",
      backgroundColor: "#c98a2b",
      borderWidth: 2,
      borderDash: [6, 4],
      tension: 0.35,
      pointStyle: "rectRot",
      pointRadius: 5,
      pointBackgroundColor: "#c98a2b",
      pointBorderColor: "#c98a2b",
      order: 1,
    } as DS,
  ];

  const ref = useChart({
    type: "bar",
    data: { labels, datasets: datasets as unknown as never },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label ?? ""}: ${Math.round(ctx.parsed.y as number).toLocaleString()} SAR`,
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
  baselines,
  shapes,
}: {
  baselines: WcxScenarioBaseline[];
  shapes: Record<string, WcxLeverShape>;
}) {
  const rows = baselines
    .map((b) => {
      const s = shapes[b.code] ?? b.shape;
      return {
        code: b.code,
        baseline: b.shape.dio + b.shape.dso - b.shape.dpo,
        adjusted: s.dio + s.dso - s.dpo,
      };
    })
    .sort((a, b) => b.adjusted - a.adjusted);

  const ref = useChart({
    type: "bar",
    data: {
      labels: rows.map((r) => r.code),
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
              ` ${ctx.dataset.label ?? ""}: ${Math.round(ctx.parsed.x as number)} days`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "rgba(11,51,120,.06)" },
          ticks: { font: { size: 10 } },
        },
        y: { grid: { display: false } },
      },
    },
  });
  return <canvas ref={ref} />;
}
