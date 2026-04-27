"use client";

import { useState, useTransition } from "react";
import { nwcOf, type SbuShape } from "@/lib/working-capital-data/derive";
import type { SbuRow } from "../types";
import styles from "../styles.module.css";
import { useChart } from "./use-chart";
import { setShowNwcTrendlinesAction } from "../actions";

export function GroupCharts({
  sbus,
  cur,
  baselines,
  initialShowTrendlines,
}: {
  sbus: SbuRow[];
  cur: Record<string, SbuShape>;
  baselines: Record<string, SbuShape>;
  initialShowTrendlines: boolean;
}) {
  // Optimistic state — we flip the local toggle immediately, then fire
  // the server action that persists the choice on users.prefs. The
  // page is force-dynamic + revalidatePath after the action, so a
  // fresh load reads the new value.
  const [showTrendlines, setShowTrendlines] = useState(initialShowTrendlines);
  const [pending, start] = useTransition();

  function onToggle(next: boolean) {
    setShowTrendlines(next);
    start(async () => {
      await setShowNwcTrendlinesAction(next);
    });
  }

  return (
    <div className={styles.dualGrid}>
      <div className={styles.panel}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3>NWC contribution by SBU</h3>
            <div className="sub">Stacked components — current vs adjusted</div>
          </div>
          <label
            className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-[11px] font-medium text-[color:var(--ink-soft)]"
            title="Overlay solid current-NWC line + dashed baseline-NWC trend"
          >
            <input
              type="checkbox"
              checked={showTrendlines}
              disabled={pending}
              onChange={(e) => onToggle(e.target.checked)}
              className="size-3.5 cursor-pointer accent-[#0b3378]"
            />
            Trend lines
          </label>
        </div>
        <div className={styles.chartWrapBig}>
          <GroupNwcChart
            sbus={sbus}
            cur={cur}
            baselines={baselines}
            showTrendlines={showTrendlines}
          />
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

// Stacked bar of NWC components (Inv / AR+Contract / Payables-) plus
// two optional overlay line series:
//   - NWC (current)  — solid medium-blue, follows the live `cur` state
//   - NWC (baseline) — dashed gold with diamond markers, follows
//                       FY-2025 baseline
// Lines are drawn on top of the bars by setting their `order` lower
// than the bar datasets'. Toggle controlled by the parent panel.
function GroupNwcChart({
  sbus,
  cur,
  baselines,
  showTrendlines,
}: {
  sbus: SbuRow[];
  cur: Record<string, SbuShape>;
  baselines: Record<string, SbuShape>;
  showTrendlines: boolean;
}) {
  const labels = sbus.map((s) => s.name);
  const inv = sbus.map((s) => (cur[s.key]?.inv ?? s.inv) as number);
  const arPlusCa = sbus.map(
    (s) => ((cur[s.key]?.ar ?? s.ar) + (cur[s.key]?.ca ?? s.ca)) as number,
  );
  const payablesNeg = sbus.map((s) => -((cur[s.key]?.ap ?? s.ap) as number));
  const nwcCur = sbus.map((s) => {
    const c = cur[s.key];
    return c
      ? nwcOf(c)
      : nwcOf({ inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap, dio: 0, dso: 0, dpo: 0 });
  });
  const nwcBase = sbus.map((s) => {
    const b = baselines[s.key];
    return b ? nwcOf(b) : nwcOf({ inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap, dio: 0, dso: 0, dpo: 0 });
  });

  // Loose dataset type — Chart.js's ChartDataset is a deeply-nested
  // discriminated union that doesn't accept mixed bar+line via the
  // strict types. Using `unknown` here and casting at the use site is
  // safer than fighting the types for a chart we know is valid.
  type DS = Record<string, unknown> & { data: number[] };
  const datasets: DS[] = [
    {
      type: "bar" as const,
      label: "Inventory",
      data: inv,
      backgroundColor: "#0b3378",
      stack: "nwc",
      order: 3,
    },
    {
      type: "bar" as const,
      label: "AR + Contract",
      data: arPlusCa,
      backgroundColor: "#418cc0",
      stack: "nwc",
      order: 3,
    },
    {
      type: "bar" as const,
      label: "Payables (–)",
      data: payablesNeg,
      backgroundColor: "#7f7f7f",
      stack: "nwc",
      order: 3,
    },
  ];

  if (showTrendlines) {
    datasets.push(
      {
        type: "line" as const,
        label: "NWC (current)",
        data: nwcCur,
        borderColor: "#2964a9",
        backgroundColor: "#2964a9",
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: "#2964a9",
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
        // Lines should NOT be stacked with the bars, and should sit on
        // top — order < bar order means rendered later in Chart.js.
        order: 0,
      } as DS,
      {
        type: "line" as const,
        label: "NWC (baseline)",
        data: nwcBase,
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
    );
  }

  const ref = useChart({
    type: "bar",
    data: { labels, datasets: datasets as unknown as never },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // mode "index" + intersect=false snaps the tooltip to the
      // hovered SBU's column so the user gets every series at once
      // (Inventory, AR + Contract, Payables, and the two trend lines)
      // instead of just the one dataset directly under the cursor.
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 10, font: { size: 11 }, usePointStyle: false },
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          callbacks: {
            // Preserve sign so Payables reads "-392 SAR m" not "392".
            label: (ctx) =>
              ` ${ctx.dataset.label ?? ""}: ${Math.round(ctx.parsed.y as number)} SAR m`,
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
