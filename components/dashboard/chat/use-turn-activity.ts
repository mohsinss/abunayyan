"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "ai";

// Live activity for an in-flight assistant turn, read off the real stream
// state of the last assistant message — which tool is running, whether prose
// is actively streaming, or whether we're in the quiet gap between steps.
// The phase is derived from events, not faked on a timer. Caveat: the slow
// wcx DATA tools (DB round-trips) reliably surface their running state, so
// "Reading the workbook…" is genuinely backend-accurate; the instant render
// tools resolve within one throttle tick, so their running labels rarely
// paint and the phase falls back to "Thinking…" — which is still honest about
// where the time goes (the LLM round-trip between charts).

export type TurnPhase = "thinking" | "tool" | "writing";

export type TurnActivity = {
  phase: TurnPhase;
  /** Human label, e.g. "Reading the workbook", "Thinking", "Still thinking". */
  label: string;
  /** Seconds spent in the current phase (for the "· 8s" suffix). */
  seconds: number;
};

// Friendly present-tense labels for a tool while it is executing.
const TOOL_RUNNING_LABELS: Record<string, string> = {
  wcxSnapshot: "Reading the workbook",
  wcxLookup: "Looking up the figure",
  wcxSeries: "Pulling the trend",
  wcxCompare: "Comparing the numbers",
  wcxAggregate: "Totalling the period",
  wcxRank: "Ranking the SBUs",
  wcxRecords: "Reading the records",
  wcxScenarioCalc: "Running the scenario",
  renderChart: "Drawing the chart",
  renderTable: "Building the table",
  renderKpiList: "Laying out the KPIs",
  renderDelta: "Building the delta",
  renderSparkline: "Drawing the sparkline",
  renderHeatmap: "Building the heatmap",
  renderQuadrant: "Plotting the quadrant",
  renderTimeline: "Building the timeline",
  renderWaterfall: "Building the bridge",
};

// How long prose must be static (no new tokens) before we stop calling it
// "writing" and treat the turn as thinking again. Above the 50ms render
// throttle and the runtime's word-smoothing cadence so a normal stream reads
// as continuous writing, but a real inter-step gap flips to "thinking".
const WRITING_IDLE_MS = 700;
// After this long in a single thinking phase, escalate the label.
const STILL_THINKING_MS = 9000;

type RawState =
  | { kind: "tool"; toolName: string }
  | { kind: "writing" }
  | { kind: "thinking" };

function readState(assistant: Message | null, textGrewRecently: boolean): RawState {
  // A tool whose result hasn't landed yet is genuinely executing server-side.
  const invs = assistant?.toolInvocations ?? [];
  const running = invs.find((inv) => inv.state !== "result");
  if (running) return { kind: "tool", toolName: running.toolName };
  if (textGrewRecently) return { kind: "writing" };
  return { kind: "thinking" };
}

/**
 * Returns the current turn activity, or null when idle or while prose is
 * actively streaming (the streaming text is its own feedback, so the spinner
 * steps aside and re-emerges only for tool runs and thinking gaps).
 */
export function useTurnActivity(messages: Message[], isLoading: boolean): TurnActivity | null {
  // Tick so seconds advance and a writing→thinking transition is noticed even
  // when no new message arrives.
  const [, force] = useState(0);
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => force((n) => (n + 1) % 1_000_000), 500);
    return () => clearInterval(id);
  }, [isLoading]);

  // Track prose growth to distinguish "actively writing" from "paused".
  const lastTextLen = useRef(0);
  const lastGrowAt = useRef(0);
  // Memoize the current phase's start so seconds are per-phase, like Claude.
  const phaseRef = useRef<{ key: string; since: number }>({ key: "", since: 0 });

  if (!isLoading) {
    lastTextLen.current = 0;
    lastGrowAt.current = 0;
    phaseRef.current = { key: "", since: 0 };
    return null;
  }

  const now = Date.now();
  const last = messages[messages.length - 1];
  const assistant = last && last.role === "assistant" ? last : null;

  const textLen = assistant?.content?.length ?? 0;
  if (textLen > lastTextLen.current) lastGrowAt.current = now;
  lastTextLen.current = textLen;
  const textGrewRecently = now - lastGrowAt.current < WRITING_IDLE_MS;

  const raw = readState(assistant, textGrewRecently);

  // Prose is streaming → hide the indicator entirely.
  if (raw.kind === "writing") {
    phaseRef.current = { key: "writing", since: now };
    return null;
  }

  const key = raw.kind === "tool" ? `tool:${raw.toolName}` : "thinking";
  if (phaseRef.current.key !== key) phaseRef.current = { key, since: now };
  const seconds = Math.floor((now - phaseRef.current.since) / 1000);

  if (raw.kind === "tool") {
    return { phase: "tool", label: TOOL_RUNNING_LABELS[raw.toolName] ?? "Working", seconds };
  }
  const stillLong = now - phaseRef.current.since >= STILL_THINKING_MS;
  return { phase: "thinking", label: stillLong ? "Still thinking" : "Thinking", seconds };
}
