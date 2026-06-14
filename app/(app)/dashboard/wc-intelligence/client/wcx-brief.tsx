"use client";

// Page island structured 1:1 like the original working-capital brief:
// sticky live ticker → hero with cash-release impact + presets → live
// group dashboard → SBU action panel (sliders pinned left) → reset —
// followed by the intelligence sections (historical trends, drill-down,
// aging, targets) that the workbook data makes possible.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WcxDashboardData } from "@/lib/wcx/dashboard-data";
import {
  applyLever,
  applyPreset,
  cashReleased,
  cccOf,
  groupTotalsOf,
  type WcxLeverField,
  type WcxLeverShape,
  type WcxScenarioBaseline,
} from "@/lib/wcx/scenario";
import styles from "../styles.module.css";
import { fmtD, fmtN, fmtPct, monthLabel } from "./format";
import { Tkpi, KpiCard } from "./kpi-cards";
import { ScenarioGroupCharts } from "./scenario-group-charts";
import { ScenarioSbuCard } from "./scenario-sbu-card";
import { ActualsKpiGrid } from "./actuals-kpis";
import { GroupCharts } from "./group-charts";
import { SbuPanel } from "./sbu-panel";
import { AgingHeatmaps } from "./aging-heatmap";
import { TargetsTable } from "./targets-table";

type Shapes = Record<string, WcxLeverShape>;

const PRESETS: Array<{ label: string; pct: string; factor: number }> = [
  { label: "Base", pct: "Actuals", factor: 0 },
  { label: "Conservative", pct: "35%", factor: 0.35 },
  { label: "Aggressive", pct: "70%", factor: 0.7 },
  { label: "Hit All Targets", pct: "100%", factor: 1 },
];

function baselineShapes(baselines: WcxScenarioBaseline[]): Shapes {
  const out: Shapes = {};
  for (const b of baselines) out[b.code] = { ...b.shape };
  return out;
}

export function WcxBrief({ data }: { data: WcxDashboardData }) {
  const baselines = data.scenario.baselines;
  const targetCashTotal = data.scenario.targetCashTotal;

  const [cur, setCur] = useState<Shapes>(() => baselineShapes(baselines));
  const [activeCode, setActiveCode] = useState(baselines[0]?.code ?? "");
  const [activePreset, setActivePreset] = useState<number | null>(0);

  const dashRef = useRef<HTMLDivElement | null>(null);
  const sbuRef = useRef<HTMLDivElement | null>(null);

  // Land on the SBU action panel on every (re)load, exactly like the
  // original brief — the levers are the primary working surface. Two rAF
  // ticks let Chart.js size before measuring; a real URL fragment wins.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        sbuRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  // Live group math.
  const groupBase = useMemo(
    () => groupTotalsOf(baselines, baselineShapes(baselines)),
    [baselines],
  );
  const groupCur = useMemo(() => groupTotalsOf(baselines, cur), [baselines, cur]);
  const release = useMemo(() => cashReleased(baselines, cur), [baselines, cur]);

  const cccCompression = groupBase.ccc - groupCur.ccc;
  const nwcPct = groupCur.annualRevenue > 0 ? (groupCur.nwc / groupCur.annualRevenue) * 100 : 0;
  const nwcPctBase = groupBase.annualRevenue > 0 ? (groupBase.nwc / groupBase.annualRevenue) * 100 : 0;
  const releasePctRev = groupBase.annualRevenue > 0 ? (release / groupBase.annualRevenue) * 100 : 0;
  const progressPct =
    targetCashTotal && targetCashTotal > 0
      ? Math.max(0, Math.min(100, (release / targetCashTotal) * 100))
      : 0;

  const onSliderChange = useCallback(
    (code: string, field: WcxLeverField, value: number) => {
      const baseline = baselines.find((b) => b.code === code);
      if (!baseline) return;
      setCur((prev) => ({
        ...prev,
        [code]: applyLever(baseline, prev[code] ?? baseline.shape, field, value),
      }));
      setActivePreset(null);
    },
    [baselines],
  );

  const onResetSbu = useCallback(
    (code: string) => {
      const baseline = baselines.find((b) => b.code === code);
      if (!baseline) return;
      setCur((prev) => ({ ...prev, [code]: { ...baseline.shape } }));
      setActivePreset(null);
    },
    [baselines],
  );

  const onPreset = useCallback(
    (factor: number) => {
      const out: Shapes = {};
      for (const b of baselines) out[b.code] = applyPreset(b, factor);
      setCur(out);
      setActivePreset(factor);
    },
    [baselines],
  );

  const onResetAll = useCallback(() => {
    setCur(baselineShapes(baselines));
    setActivePreset(0);
  }, [baselines]);

  const active = baselines.find((b) => b.code === activeCode) ?? baselines[0];

  return (
    <div className={styles.root}>
      {/* Sticky executive ticker — live group impact */}
      <div className={styles.ticker}>
        <div className={styles.tickerRow}>
          <div className={styles.tickerBrand}>
            <span className={styles.tickerDotmark} />
            <strong>Live Group Impact</strong>
            <small>· {monthLabel(data.latestMonth)} actuals baseline</small>
          </div>
          <div className={styles.tickerKpis}>
            <Tkpi
              label="Revenue (TTM)"
              value={fmtN(groupCur.annualRevenue)}
              suffix="SAR"
              delta="from workbook flows"
            />
            <Tkpi
              label="Operating NWC"
              value={fmtN(groupCur.nwc)}
              suffix="SAR"
              delta={
                Math.abs(groupCur.nwc - groupBase.nwc) < 0.5
                  ? "at baseline"
                  : `${groupCur.nwc < groupBase.nwc ? "−" : "+"}${fmtN(Math.abs(groupCur.nwc - groupBase.nwc))} vs base`
              }
              tone={groupCur.nwc <= groupBase.nwc ? "good" : "bad"}
            />
            <Tkpi
              label="NWC / Revenue"
              value={fmtPct(nwcPct)}
              delta={`baseline ${fmtPct(nwcPctBase)}`}
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
              value={`${release < 0 ? "−" : ""}${fmtN(Math.abs(release))}`}
              suffix="SAR"
              delta={targetCashTotal !== null ? `vs ${fmtN(targetCashTotal)} target` : "vs targets"}
              release
              tone={release > 0 ? "good" : release < 0 ? "bad" : undefined}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => dashRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={styles.jumpPill}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                <path d="M3 12h18" />
                <path d="M13 6l6 6-6 6" />
              </svg>
              Full dashboard
            </button>
            <button
              type="button"
              onClick={() => sbuRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={styles.jumpPill}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              SBU panel
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className="serif">
          Working Capital Intelligence — what changes if you pull the levers?
        </h1>
        <p>
          {monthLabel(data.latestMonth)} actuals from the uploaded workbook are loaded as the
          baseline. Drag any slider — Inventory, AR, Contract Assets, AP, or DIO/DSO/DPO — and the
          entire model recalculates: SBU-level NWC and CCC, group totals, charts, and identified
          cash release, priced on each SBU&apos;s real trailing-12-month flows.
        </p>

        <div className={styles.heroImpact}>
          <div>
            <div className={styles.impactTag}>If you applied these levers right now</div>
            <div className={styles.impactNum}>
              <span className={styles.impactCurrency}>SAR</span>
              <span>{fmtN(Math.abs(release))}</span>
              <span className={styles.impactUnit}>{release < 0 ? "absorbed" : "freed"}</span>
            </div>
            <div className={styles.impactSub}>
              <b>{fmtPct(releasePctRev)}</b> of group revenue · <b>{Math.round(cccCompression)}d</b>{" "}
              CCC compression · <b>{fmtPct(nwcPct)}</b> NWC / Revenue
            </div>
            {targetCashTotal !== null && (
              <>
                <div className={styles.impactBar}>
                  <div className={styles.impactBarFill} style={{ width: `${progressPct}%` }} />
                </div>
                <div className={styles.impactBarCap}>
                  progress vs SAR {fmtN(targetCashTotal)} Sheet-14 cash-release target
                </div>
              </>
            )}
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
              Each preset interpolates every SBU slider between the {monthLabel(data.latestMonth)}{" "}
              actual and its Sheet-14 operational target. Drag any slider afterwards to fine-tune —
              stored actuals never change.
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
            {data.sbus.length} SBUs · {data.months.length} months of actuals
          </span>
          <span className={styles.chip}>
            <span className={styles.chipDot} />
            Source: <b>{data.upload.filename}</b>
          </span>
        </div>
      </section>

      {/* Group dashboard — live scenario */}
      <section className={styles.section} ref={dashRef}>
        <div className={styles.sectionTitle}>
          <h2>Group dashboard</h2>
          <span className="sub">Aggregated across all SBUs · live recalculation</span>
        </div>

        <div className={styles.kpiGrid}>
          <KpiCard
            title="Group Revenue"
            value={fmtN(groupCur.annualRevenue)}
            suffix="SAR"
            sub="trailing 12 months · from workbook flows"
          />
          <KpiCard
            title="Operating NWC"
            value={fmtN(groupCur.nwc)}
            suffix="SAR"
            delta={
              Math.abs(groupCur.nwc - groupBase.nwc) < 0.5
                ? "at baseline"
                : `${groupCur.nwc < groupBase.nwc ? "−" : "+"}${fmtN(Math.abs(groupCur.nwc - groupBase.nwc))} vs base`
            }
            deltaTone={groupCur.nwc <= groupBase.nwc ? "good" : "bad"}
          />
          <KpiCard
            title="NWC / Revenue"
            value={fmtPct(nwcPct)}
            delta={`baseline ${fmtPct(nwcPctBase)}`}
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
            value={`${release < 0 ? "−" : ""}${fmtN(Math.abs(release))}`}
            suffix="SAR"
            sub={targetCashTotal !== null ? `vs ${fmtN(targetCashTotal)} target` : "vs Sheet-14 targets"}
          />
        </div>

        <ScenarioGroupCharts baselines={baselines} shapes={cur} />
      </section>

      {/* SBU action panel */}
      <section className={styles.section} ref={sbuRef}>
        <div className={styles.sectionTitle}>
          <h2>SBU action panel</h2>
          <span className="sub">Select an SBU and drag the levers</span>
        </div>

        <div className={styles.sbuTabs}>
          {baselines.map((b) => {
            const isActive = b.code === activeCode;
            return (
              <button
                key={b.code}
                type="button"
                onClick={() => setActiveCode(b.code)}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              >
                {b.code} <span className="pill">{fmtD(cccOf(cur[b.code] ?? b.shape))}</span>
              </button>
            );
          })}
        </div>

        {active && (
          <ScenarioSbuCard
            baseline={active}
            cur={cur[active.code] ?? active.shape}
            onSliderChange={onSliderChange}
            onResetSbu={onResetSbu}
          />
        )}

        <div className={styles.resetArea} style={{ marginTop: 24 }}>
          <div className="hint">
            Restore every SBU to its {monthLabel(data.latestMonth)} actual position. Group totals,
            sliders and charts will all snap back together.
          </div>
          <button
            type="button"
            onClick={onResetAll}
            className={`${styles.btnReset} ${styles.btnResetMaster}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Reset to {monthLabel(data.latestMonth)} actuals
          </button>
        </div>
      </section>

      {/* Intelligence — historical actuals */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <h2>Historical trends</h2>
          <span className="sub">
            Month-end actuals {monthLabel(data.months[0]!)} → {monthLabel(data.latestMonth)} · MoM
            and YoY deltas
          </span>
        </div>
        <ActualsKpiGrid kpis={data.kpis} />
        <GroupCharts data={data} />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <h2>SBU drill-down</h2>
          <span className="sub">Tabs ranked by cash conversion cycle, longest first</span>
        </div>
        <SbuPanel data={data} />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <h2>Aging risk</h2>
          <span className="sub">Where receivables and payables are sitting, by bucket</span>
        </div>
        <AgingHeatmaps data={data} />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <h2>Operational targets</h2>
          <span className="sub">Sheet 14 targets vs latest derived actuals</span>
        </div>
        <TargetsTable data={data} />

        <div className={styles.provenance}>
          <span>
            Source workbook: <b>{data.upload.filename}</b> · uploaded {data.upload.uploadedAt} ·{" "}
            {data.upload.factsCount.toLocaleString()} facts · {data.upload.periodStart} →{" "}
            {data.upload.periodEnd}
          </span>
          {data.upload.qa && (
            <>
              <span className={`${styles.qaBadge} ${styles.qaPass}`}>
                {data.upload.qa.passed} checks passed
              </span>
              {data.upload.qa.failed > 0 && (
                <span className={`${styles.qaBadge} ${styles.qaFail}`}>
                  {data.upload.qa.failed} flagged — see /admin/wc-intelligence
                </span>
              )}
            </>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        Abunayyan Holding · WC Intelligence board brief · figures in SAR as reported in the
        workbook · derived metrics recomputed in code · versioned source of truth in Postgres
      </footer>
    </div>
  );
}
