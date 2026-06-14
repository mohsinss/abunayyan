"use client";

import type { WcxDashboardData } from "@/lib/wcx/dashboard-data";
import styles from "../styles.module.css";
import { fmtN, fmtPct } from "./format";

const BUCKETS = ["Current", "1–30", "31–60", "61–90", "91–180", "180+"];

// Navy → red ramp on the share of total sitting in each bucket. Later
// buckets are riskier, so the tint scales with both share and bucket age.
function cellColor(share: number | null, bucketIdx: number): string {
  if (share === null) return "transparent";
  const risk = bucketIdx / (BUCKETS.length - 1);
  const intensity = Math.min(1, share * 2.2);
  const r = Math.round(11 + (200 - 11) * risk * intensity + 30 * intensity * (1 - risk));
  const g = Math.round(51 + 20 * (1 - risk) * intensity);
  const b = Math.round(120 * (1 - risk * intensity));
  return `rgba(${r}, ${g}, ${b}, ${0.1 + 0.55 * intensity})`;
}

export function AgingHeatmaps({ data }: { data: WcxDashboardData }) {
  return (
    <div className={styles.dualGrid} style={{ gridTemplateColumns: "1fr 1fr" }}>
      <HeatPanel
        title="AR aging — share of receivables"
        sub={`Month-end ${data.latestMonth} · % of each SBU's total AR per bucket`}
        rows={data.arAging}
      />
      <HeatPanel
        title="AP aging — share of payables"
        sub={`Month-end ${data.latestMonth} · % of each SBU's total AP per bucket`}
        rows={data.apAging}
      />
    </div>
  );
}

function HeatPanel({
  title,
  sub,
  rows,
}: {
  title: string;
  sub: string;
  rows: WcxDashboardData["arAging"];
}) {
  return (
    <div className={styles.panel}>
      <h3>{title}</h3>
      <div className="sub">{sub}</div>
      <table className={styles.heatTable}>
        <thead>
          <tr>
            <th>SBU</th>
            {BUCKETS.map((b) => (
              <th key={b}>{b}</th>
            ))}
            <th style={{ textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td className={styles.heatRowLabel}>{r.code}</td>
              {r.shares.map((share, i) => (
                <td
                  key={i}
                  className={styles.heatCell}
                  style={{ background: cellColor(share, i) }}
                  title={share !== null ? fmtPct(share * 100) : "no data"}
                >
                  {share !== null ? fmtPct(share * 100) : "—"}
                </td>
              ))}
              <td className={styles.heatTotal}>{fmtN(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
