"use client";

import type { WcxDashboardData } from "@/lib/wcx/dashboard-data";
import styles from "../styles.module.css";
import { useChart } from "./use-chart";
import { monthLabel } from "./format";

export function GroupCharts({ data }: { data: WcxDashboardData }) {
  return (
    <div className={styles.dualGrid}>
      <div className={styles.panel}>
        <h3>Group NWC composition — 36 months</h3>
        <div className="sub">Inventory + AR &amp; contract assets − payables, with the NWC line</div>
        <div className={styles.chartWrapBig}>
          <NwcTrendChart data={data} />
        </div>
      </div>
      <div className={styles.panel}>
        <h3>Revenue vs operating cash flow</h3>
        <div className="sub">Monthly group totals — invoiced revenue against direct OCF</div>
        <div className={styles.chartWrapBig}>
          <RevVsOcfChart data={data} />
        </div>
      </div>
    </div>
  );
}

function NwcTrendChart({ data }: { data: WcxDashboardData }) {
  const labels = data.nwcTrend.map((p) => monthLabel(p.month));
  const ref = useChart({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar" as const,
          label: "Inventory",
          data: data.nwcTrend.map((p) => p.inv),
          backgroundColor: "#0b3378",
          stack: "nwc",
          order: 3,
        },
        {
          type: "bar" as const,
          label: "AR + Contract",
          data: data.nwcTrend.map((p) => p.arCa),
          backgroundColor: "#418cc0",
          stack: "nwc",
          order: 3,
        },
        {
          type: "bar" as const,
          label: "Payables (–)",
          data: data.nwcTrend.map((p) => -p.ap),
          backgroundColor: "#7f7f7f",
          stack: "nwc",
          order: 3,
        },
        {
          type: "line" as const,
          label: "NWC",
          data: data.nwcTrend.map((p) => p.nwc),
          borderColor: "#c98a2b",
          backgroundColor: "#c98a2b",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
          order: 0,
        },
      ] as never,
    },
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
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 12 } },
        y: { stacked: true, grid: { color: "rgba(11,51,120,.06)" } },
      },
    },
  });
  return <canvas ref={ref} />;
}

function RevVsOcfChart({ data }: { data: WcxDashboardData }) {
  const labels = data.revVsOcf.map((p) => monthLabel(p.month));
  const ref = useChart({
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar" as const,
          label: "Revenue (invoiced)",
          data: data.revVsOcf.map((p) => p.revenue),
          backgroundColor: "#2964a9",
          order: 2,
        },
        {
          type: "line" as const,
          label: "Operating CF",
          data: data.revVsOcf.map((p) => p.ocf),
          borderColor: "#0e8a5f",
          backgroundColor: "#0e8a5f",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
          order: 0,
        },
      ] as never,
    },
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
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 12 } },
        y: { grid: { color: "rgba(11,51,120,.06)" } },
      },
    },
  });
  return <canvas ref={ref} />;
}
