"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyPreset,
  cashReleased,
  cccOf,
  cogsPerDay,
  groupTotalsOf,
  nwcOf,
  revPerDay,
  type SbuShape,
} from "@/lib/working-capital-data/derive";
import type { GroupRow, NarrativeRow, SbuRow } from "../types";
import styles from "../styles.module.css";
import { GroupCharts } from "./group-charts";
import { SbuCard } from "./sbu-card";

type Cur = Record<string, SbuShape>;

const PRESETS: Array<{ label: string; pct: string; factor: number }> = [
  { label: "Base", pct: "FY-25", factor: 0 },
  { label: "Conservative", pct: "35%", factor: 0.35 },
  { label: "Aggressive", pct: "70%", factor: 0.7 },
  { label: "Hit All Targets", pct: "100%", factor: 1 },
];

function toShape(s: SbuRow): SbuShape {
  return {
    inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap,
    dio: s.dio, dso: s.dso, dpo: s.dpo,
  };
}

function fmtM(v: number): string {
  const sign = v < 0 ? "−" : "";
  return sign + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) + "m";
}
function fmtPct(v: number): string {
  const sign = v < 0 ? "−" : "";
  return sign + Math.abs(v).toFixed(1) + "%";
}
function fmtD(v: number): string {
  return Math.round(v).toLocaleString() + "d";
}

export function InteractiveBrief({
  group,
  sbus,
  narrative,
}: {
  group: GroupRow;
  sbus: SbuRow[];
  narrative: NarrativeRow[];
}) {
  // Baseline copies — used to compute "vs base" deltas, never mutated.
  const baselines = useMemo<Cur>(() => {
    const out: Cur = {};
    for (const s of sbus) out[s.key] = toShape(s);
    return out;
  }, [sbus]);

  const [cur, setCur] = useState<Cur>(() => {
    const out: Cur = {};
    for (const s of sbus) out[s.key] = toShape(s);
    return out;
  });
  const [activeKey, setActiveKey] = useState<string>(sbus[0]?.key ?? "");
  const [activePreset, setActivePreset] = useState<number | null>(0);

  const dashRef = useRef<HTMLDivElement | null>(null);
  const sbuRef = useRef<HTMLDivElement | null>(null);

  // Derived totals + cash release for ticker / hero / KPI grid.
  const baselineList = useMemo(
    () => sbus.map((s) => baselines[s.key]!),
    [sbus, baselines],
  );
  const adjustedList = useMemo(
    () => sbus.map((s) => cur[s.key] ?? toShape(s)),
    [sbus, cur],
  );

  const groupBase = useMemo(() => groupTotalsOf(baselineList), [baselineList]);
  const groupCur = useMemo(() => groupTotalsOf(adjustedList), [adjustedList]);
  const release = useMemo(
    () => cashReleased(baselineList, adjustedList),
    [baselineList, adjustedList],
  );

  const onSliderChange = useCallback(
    (key: string, field: keyof SbuShape, raw: number) => {
      setCur((prev) => {
        const sbu = sbus.find((x) => x.key === key);
        if (!sbu) return prev;
        const baseline = baselines[key]!;
        const previous = prev[key] ?? toShape(sbu);
        const next: SbuShape = { ...previous };
        const cd = cogsPerDay(baseline);
        const rd = revPerDay(baseline);

        next[field] = raw;
        if (field === "inv") next.dio = cd > 0 ? raw / cd : 0;
        else if (field === "ap") next.dpo = cd > 0 ? raw / cd : 0;
        else if (field === "ar" || field === "ca") {
          next.dso = rd > 0 ? (next.ar + next.ca) / rd : 0;
        } else if (field === "dio") next.inv = raw * cd;
        else if (field === "dpo") next.ap = raw * cd;
        else if (field === "dso") {
          const baseSum = baseline.ar + baseline.ca || 1;
          const arShare = baseline.ar / baseSum;
          const newSum = raw * rd;
          next.ar = newSum * arShare;
          next.ca = newSum * (1 - arShare);
        }
        return { ...prev, [key]: next };
      });
      setActivePreset(null);
    },
    [sbus, baselines],
  );

  const onResetSbu = useCallback(
    (key: string) => {
      setCur((prev) => ({ ...prev, [key]: { ...baselines[key]! } }));
      setActivePreset(null);
    },
    [baselines],
  );

  const onResetAll = useCallback(() => {
    const out: Cur = {};
    for (const s of sbus) out[s.key] = toShape(s);
    setCur(out);
    setActivePreset(0);
  }, [sbus]);

  const onPreset = useCallback(
    (factor: number) => {
      const out: Cur = {};
      for (const s of sbus) {
        out[s.key] = applyPreset(s, factor);
      }
      setCur(out);
      setActivePreset(factor);
    },
    [sbus],
  );

  const activeSbu = sbus.find((s) => s.key === activeKey) ?? sbus[0];

  // Hero impact pieces.
  const targetRelease = group.nwcTargetRelease;
  const releasePctRev = groupBase.revenue > 0 ? (release / groupBase.revenue) * 100 : 0;
  const cccCompression = groupBase.ccc - groupCur.ccc;
  const nwcPct = groupCur.nwcPctRevenue * 100;
  const progressPct = Math.max(0, Math.min(100, (release / Math.max(1, targetRelease)) * 100));

  return (
    <div className={styles.root}>
      {/* Sticky executive ticker */}
      <div className={styles.ticker}>
        <div className={styles.tickerRow}>
          <div className={styles.tickerBrand}>
            <span className={styles.tickerDotmark} />
            <strong>Live Group Impact</strong>
            <small>· {group.fiscalYear} baseline</small>
          </div>
          <div className={styles.tickerKpis}>
            <Tkpi
              label="Revenue"
              value={`${(groupCur.revenue / 1000).toFixed(2)}`}
              suffix="SAR B"
              delta={group.fiscalYear}
            />
            <Tkpi
              label="Operating NWC"
              value={fmtM(groupCur.nwc)}
              suffix="SAR"
              delta={
                Math.abs(groupCur.nwc - groupBase.nwc) < 0.5
                  ? "at baseline"
                  : `${groupCur.nwc < groupBase.nwc ? "−" : "+"}${fmtM(Math.abs(groupCur.nwc - groupBase.nwc))} vs base`
              }
              tone={groupCur.nwc <= groupBase.nwc ? "good" : "bad"}
            />
            <Tkpi
              label="NWC / Revenue"
              value={fmtPct(nwcPct)}
              delta={`baseline ${fmtPct(groupBase.nwcPctRevenue * 100)}`}
            />
            <Tkpi
              label="Group CCC"
              value={fmtD(groupCur.ccc)}
              delta={
                Math.abs(cccCompression) < 0.5
                  ? "at baseline"
                  : `${cccCompression > 0 ? "−" : "+"}${Math.abs(Math.round(cccCompression))}d vs base`
              }
              tone={cccCompression >= 0 ? "good" : "bad"}
            />
            <Tkpi
              label="Cash Released"
              value={`${release < 0 ? "−" : ""}${Math.abs(release).toFixed(0)}`}
              suffix="SAR m"
              delta={`vs ${fmtM(targetRelease)} target`}
              release
              tone={release > 0 ? "good" : release < 0 ? "bad" : undefined}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => dashRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={styles.tab}
              style={{ borderRadius: 999 }}
            >
              Full dashboard →
            </button>
            <button
              type="button"
              onClick={() => sbuRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={styles.tab}
              style={{ borderRadius: 999 }}
            >
              SBU panel
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.serif}>
          Working Capital &amp; Cash Conversion Cycle — what changes if you change the levers?
        </h1>
        <p>
          {group.fiscalYear} actuals are loaded as the baseline. Drag any slider — Inventory, AR,
          Contract Assets, AP, or DIO/DSO/DPO — and the entire model recalculates: SBU-level NWC and
          CCC, group totals, charts, and identified cash release.
        </p>

        <div className={styles.heroImpact}>
          <div>
            <div className={styles.impactTag}>If you applied these levers right now</div>
            <div className={styles.impactNum}>
              <span className={styles.impactCurrency}>SAR</span>
              <span>{Math.abs(release).toFixed(0)}</span>
              <span className={styles.impactUnit}>{release < 0 ? "m absorbed" : "m freed"}</span>
            </div>
            <div className={styles.impactSub}>
              <b>{fmtPct(releasePctRev)}</b> of group revenue · <b>{Math.round(cccCompression)}d</b>{" "}
              CCC compression · <b>{fmtPct(nwcPct)}</b> NWC / Revenue
            </div>
            <div className={styles.impactBar}>
              <div className={styles.impactBarFill} style={{ width: `${progressPct}%` }} />
            </div>
            <div className={styles.impactBarCap}>
              progress vs SAR {Math.round(targetRelease)}m operational target
            </div>
          </div>
          <div className={styles.impactRight}>
            <div className="lbl">Scenario presets</div>
            <div className={styles.scenarioRow}>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onPreset(p.factor)}
                  className={`${styles.preset} ${activePreset === p.factor ? styles.presetActive : ""}`}
                >
                  {p.label} <span className="pct">{p.pct}</span>
                </button>
              ))}
            </div>
            <div className={styles.scenarioHelp}>
              Each preset interpolates every SBU slider between the FY-2025 actual and its
              12-month operational target. You can still drag any slider afterwards to fine-tune.
            </div>
          </div>
        </div>

        <div className={styles.heroMeta}>
          <span className={styles.chip}>
            <span className={styles.chipDot} />
            Operating NWC = <b>Inv + AR + CA − AP</b>
          </span>
          <span className={styles.chip}>
            <span className={styles.chipDot} />
            CCC = <b>DIO + DSO − DPO</b>
          </span>
          <span className={styles.chip}>
            <span className={styles.chipDot} />
            {sbus.length} active SBUs · 1 group view
          </span>
          <span className={styles.chip}>
            <span className={styles.chipDot} />
            Source: <b>wc_sbus / wc_groups (Postgres)</b>
          </span>
        </div>
      </section>

      {/* Group dashboard */}
      <section className={styles.section} ref={dashRef}>
        <div className={styles.sectionTitle}>
          <h2>Group dashboard</h2>
          <span className="sub">Aggregated across all SBUs · live recalculation</span>
        </div>

        <div className={styles.kpiGrid}>
          <KpiCard
            title="Group Revenue"
            value={`${(groupCur.revenue / 1000).toFixed(2)}`}
            suffix="SAR B"
            sub={`${group.fiscalYear} baseline · derived from BS`}
          />
          <KpiCard
            title="Operating NWC"
            value={fmtM(groupCur.nwc)}
            suffix="SAR"
            delta={
              Math.abs(groupCur.nwc - groupBase.nwc) < 0.5
                ? "at baseline"
                : `${groupCur.nwc < groupBase.nwc ? "−" : "+"}${fmtM(Math.abs(groupCur.nwc - groupBase.nwc))} vs base`
            }
            deltaTone={groupCur.nwc <= groupBase.nwc ? "good" : "bad"}
          />
          <KpiCard
            title="NWC / Revenue"
            value={fmtPct(nwcPct)}
            delta={`baseline ${fmtPct(groupBase.nwcPctRevenue * 100)}`}
          />
          <KpiCard
            title="Group CCC"
            value={fmtD(groupCur.ccc)}
            delta={
              Math.abs(cccCompression) < 0.5
                ? "at baseline"
                : `${cccCompression > 0 ? "−" : "+"}${Math.abs(Math.round(cccCompression))}d vs base`
            }
            deltaTone={cccCompression >= 0 ? "good" : "bad"}
          />
          <KpiCard
            title="Cash Released"
            value={`${release < 0 ? "−" : ""}${Math.abs(release).toFixed(0)}`}
            suffix="SAR m"
            sub={`vs ${fmtM(targetRelease)} target`}
          />
        </div>

        <GroupCharts sbus={sbus} cur={cur} baselines={baselines} />
      </section>

      {/* SBU section */}
      <section className={styles.section} ref={sbuRef}>
        <div className={styles.sectionTitle}>
          <h2>SBU action panel</h2>
          <span className="sub">Select an SBU and drag the levers</span>
        </div>

        <div className={styles.sbuTabs}>
          {sbus.map((s) => {
            const active = s.key === activeKey;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveKey(s.key)}
                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
              >
                {s.name} <span className="pill">{fmtD(cccOf(cur[s.key] ?? toShape(s)))}</span>
              </button>
            );
          })}
        </div>

        {activeSbu && (
          <SbuCard
            sbu={activeSbu}
            cur={cur[activeSbu.key] ?? toShape(activeSbu)}
            baseline={baselines[activeSbu.key]!}
            onSliderChange={onSliderChange}
            onResetSbu={onResetSbu}
          />
        )}

        <div className={styles.resetArea} style={{ marginTop: 24 }}>
          <div className="hint">
            Restore every SBU to its {group.fiscalYear} actual position. Group totals, sliders and
            charts will all snap back together.
          </div>
          <button
            type="button"
            onClick={onResetAll}
            className={`${styles.btnReset} ${styles.btnResetMaster}`}
          >
            Reset to {group.fiscalYear} baseline
          </button>
        </div>
      </section>

      {narrative.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <h2>Strategic readout</h2>
            <span className="sub">Editable narrative · synced to the chatbot KB</span>
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {narrative.map((n) => (
              <div key={n.slot} className={styles.observations}>
                <h5>{n.title || n.slot}</h5>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {n.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        Abunayyan Holding · Working Capital &amp; CCC Live Brief · figures in SAR millions unless
        otherwise stated · data sourced from Postgres (wc_groups / wc_sbus / wc_narrative)
      </footer>
    </div>
  );
}

function Tkpi({
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

function KpiCard({
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

// re-exports cccOf to keep the import-list at the top of the file tight.
nwcOf;
