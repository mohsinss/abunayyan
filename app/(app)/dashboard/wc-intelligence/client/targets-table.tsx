"use client";

import type { WcxDashboardData } from "@/lib/wcx/dashboard-data";
import styles from "../styles.module.css";
import { fmtD } from "./format";

// Latest derived day-counts vs the Sheet-14 operational targets. Gap tones:
// for DIO/DSO/CCC lower is better; for DPO higher is better.
export function TargetsTable({ data }: { data: WcxDashboardData }) {
  return (
    <div className={styles.panel}>
      <h3>Targets vs actuals — cash cycle days</h3>
      <div className="sub">
        Actuals derived from month-end {data.latestMonth} balances over trailing-12-month flows ·
        targets from Sheet 14 (apply FY-26 forward)
      </div>
      <table className={styles.targetsTable}>
        <thead>
          <tr>
            <th>SBU</th>
            <th>DIO act / tgt</th>
            <th>DSO act / tgt</th>
            <th>DPO act / tgt</th>
            <th>CCC act / tgt</th>
            <th>CCC gap</th>
          </tr>
        </thead>
        <tbody>
          {data.targets.map((t) => {
            const gap =
              t.actualCcc !== null && t.targetCcc !== null ? t.actualCcc - t.targetCcc : null;
            return (
              <tr key={t.code}>
                <td>{t.code}</td>
                <td>
                  {fmtD(t.actualDio)} / <span className={styles.gapMuted}>{fmtD(t.targetDio)}</span>
                </td>
                <td>
                  {fmtD(t.actualDso)} / <span className={styles.gapMuted}>{fmtD(t.targetDso)}</span>
                </td>
                <td>
                  {fmtD(t.actualDpo)} / <span className={styles.gapMuted}>{fmtD(t.targetDpo)}</span>
                </td>
                <td>
                  {fmtD(t.actualCcc)} / <span className={styles.gapMuted}>{fmtD(t.targetCcc)}</span>
                </td>
                <td className={gap === null ? styles.gapMuted : gap <= 0 ? styles.gapGood : styles.gapBad}>
                  {gap === null ? "—" : `${gap > 0 ? "+" : "−"}${Math.abs(Math.round(gap))}d`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
