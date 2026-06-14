"use client";

// Historical actuals KPI strip (month-over-month / year-over-year deltas)
// shown in the intelligence half of the page — distinct from the live
// scenario KPIs in the group dashboard.

import type { Kpi, WcxDashboardData } from "@/lib/wcx/dashboard-data";
import styles from "../styles.module.css";
import { fmtD, fmtDelta, fmtN } from "./format";
import { KpiCard } from "./kpi-cards";

function deltaParts(kpi: Kpi, lowerIsGood: boolean, days: boolean) {
  const d = kpi.delta1m;
  if (d === null) return { text: "no prior month", tone: undefined as "good" | "bad" | undefined };
  if (Math.abs(d) < 0.05) return { text: "flat vs last month", tone: undefined };
  const good = lowerIsGood ? d < 0 : d > 0;
  return {
    text: `${fmtDelta(d, days ? "d" : "")} vs last month`,
    tone: (good ? "good" : "bad") as "good" | "bad",
  };
}

export function ActualsKpiGrid({ kpis }: { kpis: WcxDashboardData["kpis"] }) {
  const cells: Array<{
    title: string;
    value: string;
    suffix?: string;
    kpi: Kpi;
    lowerIsGood?: boolean;
    days?: boolean;
  }> = [
    { title: "Group NWC", value: fmtN(kpis.nwc.value), suffix: "SAR", kpi: kpis.nwc, lowerIsGood: true },
    { title: "Group CCC", value: fmtD(kpis.ccc.value), kpi: kpis.ccc, lowerIsGood: true, days: true },
    { title: "Revenue (TTM)", value: fmtN(kpis.revenueTtm.value), suffix: "SAR", kpi: kpis.revenueTtm },
    { title: "Operating CF (TTM)", value: fmtN(kpis.ocfTtm.value), suffix: "SAR", kpi: kpis.ocfTtm },
    { title: "Closing Cash", value: fmtN(kpis.cash.value), suffix: "SAR", kpi: kpis.cash },
  ];

  return (
    <div className={styles.kpiGrid}>
      {cells.map((c) => {
        const d = deltaParts(c.kpi, c.lowerIsGood ?? false, c.days ?? false);
        return (
          <KpiCard
            key={c.title}
            title={c.title}
            value={c.value}
            suffix={c.suffix}
            delta={d.text}
            deltaTone={d.tone}
            sub={
              c.kpi.delta12m !== null
                ? `${fmtDelta(c.kpi.delta12m, c.days ? "d" : "")} vs a year ago`
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
