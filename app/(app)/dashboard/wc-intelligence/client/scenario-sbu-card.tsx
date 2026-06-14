"use client";

import { useMemo } from "react";
import {
  cccOf,
  nwcOf,
  type WcxLeverField,
  type WcxLeverShape,
  type WcxScenarioBaseline,
} from "@/lib/wcx/scenario";
import styles from "../styles.module.css";
import { useChart } from "./use-chart";

function fmt(v: number, isDays: boolean): string {
  return isDays
    ? Math.round(v).toLocaleString() + "d"
    : (v < 0 ? "−" : "") +
        Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function ScenarioSbuCard({
  baseline,
  cur,
  onSliderChange,
  onResetSbu,
}: {
  baseline: WcxScenarioBaseline;
  cur: WcxLeverShape;
  onSliderChange: (_code: string, _field: WcxLeverField, _value: number) => void;
  onResetSbu: (_code: string) => void;
}) {
  const nwcNow = nwcOf(cur);
  const cccNow = cccOf(cur);
  const dN = nwcNow - nwcOf(baseline.shape);
  const dC = cccNow - cccOf(baseline.shape);

  return (
    <div className={styles.sbuCard}>
      <div className={styles.sbuHead}>
        <div>
          <h3>{baseline.name !== baseline.code ? `${baseline.code} — ${baseline.name}` : baseline.code}</h3>
          <p>
            Baseline = latest month-end actuals · daily flows from the SBU&apos;s real
            trailing-12-month revenue and COGS. Dragging a lever reprices the coupled
            balance / day-count live.
          </p>
          <div className={styles.targetsLine}>
            Each slider shows an <b>amber marker</b> at its Sheet-14 operational target. Hit it and
            the row turns green.
          </div>
        </div>
      </div>

      <div className={styles.sbuSplit}>
        {/* LEFT: sliders */}
        <div className={styles.slidersPane}>
          <div className={styles.stickySummary}>
            <div className={styles.summaryRow}>
              <SummaryCell label="Operating NWC" value={`${Math.round(nwcNow).toLocaleString()}`} unit="SAR" delta={dN} lowerIsGood />
              <SummaryCell label="CCC (days)" value={`${Math.round(cccNow)}`} unit="days" delta={dC} lowerIsGood days right />
            </div>
          </div>

          <div className={styles.lever}>
            <h4>NWC components</h4>
            <div className="descr">Drag balance-sheet line items (SAR). DIO / DSO / DPO follow.</div>
            <span className="formula">NWC = Inv + AR + CA − AP</span>
            <SliderRow baseline={baseline} field="inv" label="Inventory" unit="SAR" cur={cur.inv} onChange={onSliderChange} />
            <SliderRow baseline={baseline} field="ar" label="Trade Receivables" unit="SAR" cur={cur.ar} onChange={onSliderChange} />
            <SliderRow baseline={baseline} field="ca" label="Contract Assets" unit="SAR" cur={cur.ca} onChange={onSliderChange} />
            <SliderRow baseline={baseline} field="ap" label="Accounts Payable" unit="SAR" cur={cur.ap} onChange={onSliderChange} />
          </div>

          <div className={styles.lever}>
            <h4>CCC components</h4>
            <div className="descr">Drag the day-counts. Inventory / AR+CA / AP follow.</div>
            <span className="formula">CCC = DIO + DSO − DPO</span>
            <SliderRow baseline={baseline} field="dio" label="Days Inventory Outst." unit="days" cur={cur.dio} onChange={onSliderChange} />
            <SliderRow baseline={baseline} field="dso" label="Days Sales Outst." unit="days" cur={cur.dso} onChange={onSliderChange} />
            <SliderRow baseline={baseline} field="dpo" label="Days Payable Outst." unit="days" cur={cur.dpo} onChange={onSliderChange} />
          </div>

          <div className={styles.resetArea} style={{ marginTop: 0, paddingTop: 14 }}>
            <div className="hint" style={{ maxWidth: "55%" }}>
              Reset this SBU to its latest actuals.
            </div>
            <button type="button" onClick={() => onResetSbu(baseline.code)} className={styles.btnReset}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
              Reset {baseline.code}
            </button>
          </div>
        </div>

        {/* RIGHT: baseline vs adjusted charts */}
        <div className={styles.scrollPane}>
          <div className={styles.chartsRow}>
            <div className={styles.miniChart}>
              <h5>NWC composition · baseline vs adjusted</h5>
              <div className="sub">SAR · hover for the Sheet-14 target per component</div>
              <div className={styles.canvasBox}>
                <ComponentChart
                  labels={["Inventory", "AR", "Contract Assets", "AP"]}
                  base={[baseline.shape.inv, baseline.shape.ar, baseline.shape.ca, baseline.shape.ap]}
                  adjusted={[cur.inv, cur.ar, cur.ca, cur.ap]}
                  targets={[baseline.target.inv, baseline.target.ar, baseline.target.ca, baseline.target.ap]}
                  unit="SAR"
                />
              </div>
            </div>
            <div className={styles.miniChart}>
              <h5>CCC components · baseline vs adjusted</h5>
              <div className="sub">days · hover for the Sheet-14 target per component</div>
              <div className={styles.canvasBox}>
                <ComponentChart
                  labels={["DIO", "DSO", "DPO"]}
                  base={[baseline.shape.dio, baseline.shape.dso, baseline.shape.dpo]}
                  adjusted={[cur.dio, cur.dso, cur.dpo]}
                  targets={[baseline.target.dio, baseline.target.dso, baseline.target.dpo]}
                  unit="days"
                />
              </div>
            </div>
          </div>

          <div className={styles.observations}>
            <h5>How this scenario is priced</h5>
            <p>
              {baseline.code} runs on ~{fmt(baseline.cogsPerDay, false)} SAR/day of COGS and ~
              {fmt(baseline.revPerDay, false)} SAR/day of revenue (trailing 12 months from the
              workbook). A 1-day DSO cut frees about {fmt(baseline.revPerDay, false)} SAR of
              receivables; a 1-day DPO extension funds about {fmt(baseline.cogsPerDay, false)} SAR.
              Scenario state is what-if only — stored actuals are never modified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  unit,
  delta,
  lowerIsGood,
  days = false,
  right = false,
}: {
  label: string;
  value: string;
  unit: string;
  delta: number;
  lowerIsGood: boolean;
  days?: boolean;
  right?: boolean;
}) {
  const flat = Math.abs(delta) < 0.5;
  const good = lowerIsGood ? delta < 0 : delta > 0;
  return (
    <div className={styles.summaryCell} style={right ? { textAlign: "right" } : undefined}>
      <div className={styles.summaryLbl}>{label}</div>
      <div className={styles.summaryVal}>
        {value} <small>{unit}</small>
      </div>
      <div
        className={`${styles.summaryDelta} ${flat ? "" : good ? styles.summaryDeltaGood : styles.summaryDeltaBad}`}
      >
        {flat ? (
          "at baseline"
        ) : (
          <>
            <b>
              {delta > 0 ? "+" : "−"}
              {days ? `${Math.abs(Math.round(delta))}d` : Math.abs(delta).toFixed(0)}
            </b>{" "}
            vs base
          </>
        )}
      </div>
    </div>
  );
}

function SliderRow({
  baseline,
  field,
  label,
  unit,
  cur,
  onChange,
}: {
  baseline: WcxScenarioBaseline;
  field: WcxLeverField;
  label: string;
  unit: "SAR" | "days";
  cur: number;
  onChange: (_code: string, _field: WcxLeverField, _value: number) => void;
}) {
  const isDays = unit === "days";
  const base = baseline.shape[field];
  const target = baseline.target[field];

  const max = useMemo(() => {
    const refMax = Math.max(base, target ?? 0);
    if (refMax === 0) return isDays ? 60 : 30;
    return Math.max(Math.ceil((refMax * 1.6) / 5) * 5, refMax + 20);
  }, [base, target, isDays]);

  const hasTarget = target !== undefined && target !== null;
  const targetPct = hasTarget && max > 0 ? (target / max) * 100 : 0;
  const targetTxt = hasTarget ? fmt(target, isDays) : "—";
  const tolerance = Math.max(1, max * 0.03);
  const onTarget = hasTarget && Math.abs(cur - target) <= tolerance;
  const fillPct = Math.min(100, Math.max(0, (cur / max) * 100));

  const d = cur - base;
  let tone: "good" | "bad" | "" = "";
  if (Math.abs(d) >= 0.5) {
    const goodDir = field === "ap" || field === "dpo" ? d > 0 : d < 0;
    tone = goodDir ? "good" : "bad";
  }

  return (
    <div className={`${styles.sliderRow} ${onTarget ? styles.onTarget : ""}`}>
      <div className="lab">
        {label}
        <span className="unit">{unit}</span>
      </div>
      <div className={styles.sliderWrap}>
        {hasTarget && (
          <>
            <div className={styles.sweetSpot} style={{ left: `${targetPct.toFixed(2)}%` }} />
            <div className={styles.sweetLabel} style={{ left: `${targetPct.toFixed(2)}%` }}>
              ▼ target {targetTxt}
            </div>
          </>
        )}
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={Math.round(cur)}
          onChange={(e) => onChange(baseline.code, field, parseFloat(e.target.value))}
          style={{ ["--pct" as string]: `${fillPct.toFixed(1)}%` }}
        />
      </div>
      <div className="vals">
        <span>{fmt(cur, isDays)}</span>
        <span className="targetLine">target {targetTxt}</span>
        <span className={`delta ${tone}`}>
          {Math.abs(d) < 0.5 ? "·" : `${d > 0 ? "+" : "−"}${fmt(Math.abs(d), isDays)}`}
        </span>
      </div>
    </div>
  );
}

function ComponentChart({
  labels,
  base,
  adjusted,
  targets,
  unit,
}: {
  labels: string[];
  base: number[];
  adjusted: number[];
  targets: Array<number | undefined>;
  unit: string;
}) {
  const ref = useChart({
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Baseline", data: base, backgroundColor: "#418cc0", borderRadius: 4 },
        { label: "Adjusted", data: adjusted, backgroundColor: "#0b3378", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" as const, labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label ?? ""}: ${Math.round(ctx.parsed.y as number)} ${unit}`,
            afterLabel: (ctx) => {
              const t = targets[ctx.dataIndex];
              return t !== undefined ? `Target: ${Math.round(t)} ${unit}` : "";
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "rgba(11,51,120,.06)" }, ticks: { font: { size: 10 } } },
      },
    },
  });
  return <canvas ref={ref} />;
}
