"use client";

// Ticker + KPI card primitives, markup identical to the working-capital
// brief's Tkpi / KpiCard so the visual system matches 1:1.

import styles from "../styles.module.css";

export function Tkpi({
  label,
  value,
  suffix,
  delta,
  release,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  delta?: string;
  release?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <div className={`${styles.tkpi} ${release ? styles.tkpiRelease : ""}`}>
      <div className="lbl">{label}</div>
      <div className="val">
        {value}
        {suffix ? <small> {suffix}</small> : null}
      </div>
      {delta && <div className={`delta ${tone ?? ""}`}>{delta}</div>}
    </div>
  );
}

export function KpiCard({
  title,
  value,
  suffix,
  delta,
  deltaTone,
  sub,
}: {
  title: string;
  value: string;
  suffix?: string;
  delta?: string;
  deltaTone?: "good" | "bad";
  sub?: string;
}) {
  return (
    <div className={styles.kpi}>
      <h3>{title}</h3>
      <div className="v">
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </div>
      {delta && (
        <div
          className={`delta ${deltaTone === "good" ? styles.deltaGood : ""} ${deltaTone === "bad" ? styles.deltaBad : ""}`}
        >
          <b>{delta}</b>
        </div>
      )}
      {sub && <div className="baseline">{sub}</div>}
    </div>
  );
}
