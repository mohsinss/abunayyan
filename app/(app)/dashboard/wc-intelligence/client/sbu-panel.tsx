"use client";

import { useState } from "react";
import type { WcxDashboardData } from "@/lib/wcx/dashboard-data";
import styles from "../styles.module.css";
import { useChart } from "./use-chart";
import { fmtD, fmtN, monthLabel } from "./format";

// SBU drill-down: tab strip (CCC pill per SBU, like the WC brief) plus the
// selected SBU's CCC ranking position, days decomposition, and 36-month
// NWC / CCC mini charts.
export function SbuPanel({ data }: { data: WcxDashboardData }) {
  const ranked = [...data.cccBySbu].sort(
    (a, b) => (b.ccc ?? -Infinity) - (a.ccc ?? -Infinity),
  );
  const [activeCode, setActiveCode] = useState(ranked[0]?.code ?? "");
  const active = data.cccBySbu.find((s) => s.code === activeCode) ?? data.cccBySbu[0];
  const trend = data.sbuTrends[active?.code ?? ""] ?? [];

  if (!active) return null;

  return (
    <>
      <div className={styles.sbuTabs}>
        {ranked.map((s) => (
          <button
            key={s.code}
            type="button"
            onClick={() => setActiveCode(s.code)}
            className={`${styles.tab} ${s.code === activeCode ? styles.tabActive : ""}`}
          >
            {s.code} <span className="pill">{fmtD(s.ccc)}</span>
          </button>
        ))}
      </div>

      <div className={styles.sbuCard}>
        <div className={styles.sbuHead}>
          <div>
            <h3>{active.name !== active.code ? `${active.code} — ${active.name}` : active.code}</h3>
            <p>
              Cash conversion cycle <b>{fmtD(active.ccc)}</b> as of {monthLabel(data.latestMonth)} ·
              DIO <b>{fmtD(active.dio)}</b> + DSO <b>{fmtD(active.dso)}</b> − DPO{" "}
              <b>{fmtD(active.dpo)}</b>. Derived in code from month-end balances over
              trailing-12-month flows.
            </p>
          </div>
        </div>

        <div className={styles.chartsRow}>
          <div className={styles.miniChart}>
            <h5>NWC — 36 months</h5>
            <div className="sub">Month-end net working capital (SAR)</div>
            <div className={styles.canvasBox}>
              <MiniTrend
                labels={trend.map((p) => monthLabel(p.month))}
                values={trend.map((p) => p.nwc)}
                color="#0b3378"
                fill
              />
            </div>
          </div>
          <div className={styles.miniChart}>
            <h5>CCC — 36 months</h5>
            <div className="sub">Days, derived monthly (TTM basis)</div>
            <div className={styles.canvasBox}>
              <MiniTrend
                labels={trend.map((p) => monthLabel(p.month))}
                values={trend.map((p) => p.ccc)}
                color="#c98a2b"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MiniTrend({
  labels,
  values,
  color,
  fill = false,
}: {
  labels: string[];
  values: Array<number | null>;
  color: string;
  fill?: boolean;
}) {
  const ref = useChart({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: color,
          backgroundColor: fill ? `${color}22` : color,
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
          fill,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${fmtN(ctx.parsed.y as number)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 9 } },
        y: { grid: { color: "rgba(11,51,120,.06)" }, ticks: { font: { size: 10 } } },
      },
    },
  });
  return <canvas ref={ref} />;
}
