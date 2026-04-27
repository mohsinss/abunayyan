"use client";

import { useMemo } from "react";
import { cccOf, nwcOf, type SbuShape } from "@/lib/working-capital-data/derive";
import type { SbuRow } from "../types";
import styles from "../styles.module.css";
import { useChart } from "./use-chart";

type SliderField = "inv" | "ar" | "ca" | "ap" | "dio" | "dso" | "dpo";

function fmt(v: number, isDays: boolean): string {
  return isDays
    ? Math.round(v).toLocaleString() + "d"
    : (v < 0 ? "−" : "") +
        Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) +
        "m";
}

function deltaOf(cur: number, base: number, isDays: boolean) {
  const d = cur - base;
  if (Math.abs(d) < 0.5) return { text: "·", tone: "" as const };
  const sign = d > 0 ? "+" : "−";
  const text = sign + (isDays ? Math.abs(Math.round(d)) + "d" : fmt(Math.abs(d), false));
  return { text, tone: "" as const, raw: d };
}

export function SbuCard({
  sbu,
  cur,
  baseline,
  onSliderChange,
  onResetSbu,
}: {
  sbu: SbuRow;
  cur: SbuShape;
  baseline: SbuShape;
  onSliderChange: (_key: string, _field: keyof SbuShape, _value: number) => void;
  onResetSbu: (_key: string) => void;
}) {
  const nwcNow = nwcOf(cur);
  const cccNow = cccOf(cur);
  const nwcBase = nwcOf(baseline);
  const cccBase = cccOf(baseline);

  const dN = nwcNow - nwcBase;
  const dC = cccNow - cccBase;

  return (
    <div className={styles.sbuCard}>
      <div className={styles.sbuHead}>
        <div>
          <h3>{sbu.name}</h3>
          <p>
            <b>{sbu.shareText}</b> · {sbu.posture}
          </p>
          <div className={styles.targetsLine}>
            Each slider shows an <b>amber marker</b> at its 12-month operational sweet spot. Hit it
            and the row turns green.
          </div>
        </div>
      </div>

      <div className={styles.sbuSplit}>
        {/* LEFT: sliders */}
        <div className={styles.slidersPane}>
          <div className={styles.stickySummary}>
            <div className={styles.summaryRow}>
              <div className={styles.summaryCell}>
                <div className={styles.summaryLbl}>Operating NWC</div>
                <div className={styles.summaryVal}>
                  {Math.round(nwcNow)} <small>SAR m</small>
                </div>
                <div
                  className={`${styles.summaryDelta} ${
                    Math.abs(dN) < 0.5
                      ? ""
                      : dN < 0
                        ? styles.summaryDeltaGood
                        : styles.summaryDeltaBad
                  }`}
                >
                  {Math.abs(dN) < 0.5 ? (
                    "at baseline"
                  ) : (
                    <>
                      <b>
                        {dN > 0 ? "+" : "−"}
                        {Math.abs(dN).toFixed(0)}m
                      </b>{" "}
                      vs base
                    </>
                  )}
                </div>
              </div>
              <div className={styles.summaryCell} style={{ textAlign: "right" }}>
                <div className={styles.summaryLbl}>CCC (days)</div>
                <div className={styles.summaryVal}>
                  {Math.round(cccNow)} <small>days</small>
                </div>
                <div
                  className={`${styles.summaryDelta} ${
                    Math.abs(dC) < 0.5
                      ? ""
                      : dC < 0
                        ? styles.summaryDeltaGood
                        : styles.summaryDeltaBad
                  }`}
                >
                  {Math.abs(dC) < 0.5 ? (
                    "at baseline"
                  ) : (
                    <>
                      <b>
                        {dC > 0 ? "+" : "−"}
                        {Math.abs(Math.round(dC))}d
                      </b>{" "}
                      vs base
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.lever}>
            <h4>NWC components</h4>
            <div className="descr">Drag balance-sheet line items (SAR m). DIO / DSO / DPO follow.</div>
            <span className="formula">NWC = Inv + AR + CA − AP</span>
            <SliderRow sbuKey={sbu.key} field="inv" label="Inventory" unit="SAR m" cur={cur.inv} base={baseline.inv} target={sbu.tInv} onChange={onSliderChange} />
            <SliderRow sbuKey={sbu.key} field="ar" label="Trade Receivables" unit="SAR m" cur={cur.ar} base={baseline.ar} target={sbu.tAr} onChange={onSliderChange} />
            <SliderRow sbuKey={sbu.key} field="ca" label="Contract Assets" unit="SAR m" cur={cur.ca} base={baseline.ca} target={sbu.tCa} onChange={onSliderChange} />
            <SliderRow sbuKey={sbu.key} field="ap" label="Accounts Payable" unit="SAR m" cur={cur.ap} base={baseline.ap} target={sbu.tAp} onChange={onSliderChange} />
          </div>

          <div className={styles.lever}>
            <h4>CCC components</h4>
            <div className="descr">Drag the day-counts. Inventory / AR+CA / AP follow.</div>
            <span className="formula">CCC = DIO + DSO − DPO</span>
            <SliderRow sbuKey={sbu.key} field="dio" label="Days Inventory Outst." unit="days" cur={cur.dio} base={baseline.dio} target={sbu.tDio} onChange={onSliderChange} />
            <SliderRow sbuKey={sbu.key} field="dso" label="Days Sales Outst." unit="days" cur={cur.dso} base={baseline.dso} target={sbu.tDso} onChange={onSliderChange} />
            <SliderRow sbuKey={sbu.key} field="dpo" label="Days Payable Outst." unit="days" cur={cur.dpo} base={baseline.dpo} target={sbu.tDpo} onChange={onSliderChange} />
          </div>

          <div className={styles.resetArea} style={{ marginTop: 0, paddingTop: 14 }}>
            <div className="hint" style={{ maxWidth: "55%" }}>
              Reset this SBU to its FY-2025 actual.
            </div>
            <button type="button" onClick={() => onResetSbu(sbu.key)} className={styles.btnReset}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
              Reset {sbu.name}
            </button>
          </div>
        </div>

        {/* RIGHT: charts + observations */}
        <div className={styles.scrollPane}>
          <div className={styles.chartsRow}>
            <div className={styles.miniChart}>
              <h5>NWC composition · current vs adjusted</h5>
              <div className="sub">SAR millions · amber dotted line marks each component&apos;s target</div>
              <div className={styles.canvasBox}>
                <SbuNwcChart sbu={sbu} cur={cur} />
              </div>
            </div>
            <div className={styles.miniChart}>
              <h5>CCC components · current vs adjusted</h5>
              <div className="sub">days · amber dotted line marks each component&apos;s target</div>
              <div className={styles.canvasBox}>
                <SbuCccChart sbu={sbu} cur={cur} />
              </div>
            </div>
          </div>

          <div className={styles.observations}>
            <h5>Observations &amp; identified levers</h5>
            <ul>
              {sbu.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  sbuKey,
  field,
  label,
  unit,
  cur,
  base,
  target,
  onChange,
}: {
  sbuKey: string;
  field: SliderField;
  label: string;
  unit: "SAR m" | "days";
  cur: number;
  base: number;
  target: number;
  onChange: (_key: string, _field: keyof SbuShape, _value: number) => void;
}) {
  const isDays = unit === "days";
  // Slider range mirrors the HTML's calc.
  const max = useMemo(() => {
    if (base === 0 && target === 0) return isDays ? 60 : 30;
    const refMax = Math.max(base, target);
    let m = Math.max(Math.ceil((refMax * 1.6) / 5) * 5, refMax + 20);
    if (sbuKey === "STCL" && field === "dso") m = 2200;
    if (sbuKey === "STCL" && field === "dpo") m = 800;
    return m;
  }, [base, target, isDays, sbuKey, field]);

  const targetPct = max > 0 ? (target / max) * 100 : 0;
  const targetTxt = isDays ? Math.round(target) + "d" : Math.round(target) + "m";
  const tolerance = Math.max(1, max * 0.03);
  const onTarget = Math.abs(cur - target) <= tolerance;
  const fillPct = Math.min(100, Math.max(0, (cur / max) * 100));
  const d = deltaOf(cur, base, isDays);
  // For AP/DPO, "good" direction is up (more leverage). For everything else, "good" is down.
  let tone: "good" | "bad" | "" = "";
  if (d.raw !== undefined) {
    const goodDir = field === "ap" || field === "dpo" ? d.raw > 0 : d.raw < 0;
    tone = goodDir ? "good" : "bad";
  }

  return (
    <div className={`${styles.sliderRow} ${onTarget ? styles.onTarget : ""}`}>
      <div className="lab">
        {label}
        <span className="unit">{unit}</span>
      </div>
      <div className={styles.sliderWrap}>
        <div className={styles.sweetSpot} style={{ left: `${targetPct.toFixed(2)}%` }} />
        <div className={styles.sweetLabel} style={{ left: `${targetPct.toFixed(2)}%` }}>
          ▼ target {targetTxt}
        </div>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={Math.round(cur)}
          onChange={(e) => onChange(sbuKey, field, parseFloat(e.target.value))}
          style={{ ["--pct" as string]: `${fillPct.toFixed(1)}%` }}
        />
      </div>
      <div className="vals">
        <span>{fmt(cur, isDays)}</span>
        <span className="targetLine">target {targetTxt}</span>
        <span className={`delta ${tone}`}>{d.text}</span>
      </div>
    </div>
  );
}

const COMPONENT_LABELS = ["Inventory", "AR", "Contract Assets", "AP"];

function SbuNwcChart({ sbu, cur }: { sbu: SbuRow; cur: SbuShape }) {
  const ref = useChart({
    type: "bar",
    data: {
      labels: COMPONENT_LABELS,
      datasets: [
        {
          label: "Baseline",
          data: [sbu.inv, sbu.ar, sbu.ca, sbu.ap],
          backgroundColor: "#418cc0",
          borderRadius: 4,
        },
        {
          label: "Adjusted",
          data: [cur.inv, cur.ar, cur.ca, cur.ap],
          backgroundColor: "#0b3378",
          borderRadius: 4,
        },
      ],
    },
    options: chartOptions("SAR m", [sbu.tInv, sbu.tAr, sbu.tCa, sbu.tAp]),
  });
  return <canvas ref={ref} />;
}

function SbuCccChart({ sbu, cur }: { sbu: SbuRow; cur: SbuShape }) {
  const ref = useChart({
    type: "bar",
    data: {
      labels: ["DIO", "DSO", "DPO"],
      datasets: [
        {
          label: "Baseline",
          data: [sbu.dio, sbu.dso, sbu.dpo],
          backgroundColor: "#418cc0",
          borderRadius: 4,
        },
        {
          label: "Adjusted",
          data: [cur.dio, cur.dso, cur.dpo],
          backgroundColor: "#0b3378",
          borderRadius: 4,
        },
      ],
    },
    options: chartOptions("days", [sbu.tDio, sbu.tDso, sbu.tDpo]),
  });
  return <canvas ref={ref} />;
}

// Minimal Chart.js options. Targets are passed as a hint to render an
// amber dashed line per category; in v1 we render them as a second
// "Target" series shown as horizontal markers via a faint fill.
function chartOptions(unit: string, targets: number[]) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { boxWidth: 10, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            ` ${ctx.dataset.label ?? ""}: ${Math.round(ctx.parsed.y)} ${unit}`,
          afterLabel: (ctx: { dataIndex: number }) =>
            targets[ctx.dataIndex] !== undefined
              ? `Target: ${Math.round(targets[ctx.dataIndex] ?? 0)} ${unit}`
              : "",
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: "rgba(11,51,120,.06)" }, ticks: { font: { size: 10 } } },
    },
  };
}
