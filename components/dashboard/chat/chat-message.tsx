"use client";

import { memo, useMemo } from "react";
import { Check, Loader2 } from "lucide-react";
import { type Message } from "ai";
import { ChatChart, type ChartArgs } from "./chat-chart";
import { ChatTable, type TableArgs } from "./chat-table";
import { ChatKpi, type KpiArgs } from "./chat-kpi";
import { ChatDelta, type DeltaArgs } from "./chat-delta";
import { ChatSparkline, type SparklineArgs } from "./chat-sparkline";
import { ChatHeatmap, type HeatmapArgs } from "./chat-heatmap";
import { ChatQuadrant, type QuadrantArgs } from "./chat-quadrant";
import { ChatTimeline, type TimelineArgs } from "./chat-timeline";
import { ChatWaterfall, type WaterfallArgs } from "./chat-waterfall";

// Tool names whose results we render visually inside the bubble.
// Anything else (searchDatasetDocs, atlasSnapshot, wcSnapshot,
// wcScenarioCalc, queryDatasetRows raw output) is consumed silently
// by the model.
const VISIBLE_TOOL_NAMES = new Set([
  "renderChart",
  "renderTable",
  "renderKpiList",
  "renderDelta",
  "renderSparkline",
  "renderHeatmap",
  "renderQuadrant",
  "renderTimeline",
  "renderWaterfall",
]);

// Silent data tools — they return no visual, but we surface each as a small
// completed "step" row (Claude-style processing trail) so the reply shows the
// work it did, interleaved with the prose and charts. Past tense: by the time
// a step renders in the bubble its result has landed.
const STEP_LABELS: Record<string, string> = {
  wcxSnapshot: "Read the workbook",
  wcxLookup: "Looked up the figure",
  wcxSeries: "Pulled the trend",
  wcxCompare: "Compared the numbers",
  wcxAggregate: "Totalled the period",
  wcxRank: "Ranked the SBUs",
  wcxRecords: "Read the records",
  wcxScenarioCalc: "Ran the scenario",
};

function ChatStep({ toolName }: { toolName: string }) {
  const label = STEP_LABELS[toolName];
  if (!label) return null;
  return (
    <div className="my-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[1px] text-atlas-ink-3">
      <Check className="size-3 opacity-70" />
      <span>{label}</span>
    </div>
  );
}

// Minimal markdown rendering — bold + inline code + line breaks. No full
// markdown parser needed; responses are intentionally terse.
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0;
  const regex = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > i) parts.push(text.slice(i, match.index));
    if (match[1]) parts.push(<strong key={match.index} className="font-semibold text-atlas-ink">{match[1]}</strong>);
    else if (match[2])
      parts.push(
        <code key={match.index} className="rounded-sm bg-atlas-bg-3 px-1 py-px font-mono text-[11px]">
          {match[2]}
        </code>,
      );
    i = regex.lastIndex;
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

// Blinking caret that trails the streaming text for a live "typing" feel.
function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[0.95em] w-[2px] translate-y-[2px] animate-pulse rounded-sm bg-atlas-ink/70 align-text-bottom"
    />
  );
}

function Prose({ text, caret = false }: { text: string; caret?: boolean }) {
  // Recomputed only when `text` changes. During streaming the last
  // message's text grows each throttle tick; memoizing keeps the split +
  // per-line regex from re-running on unrelated re-renders.
  const blocks = useMemo(() => text.split(/\n{2,}/).filter(Boolean), [text]);
  return (
    <>
      {blocks.map((block, bi) => {
        const isLast = bi === blocks.length - 1;
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="my-2 ml-4 list-disc space-y-1 text-[13px] leading-relaxed">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-•]\s+/, ""))}</li>
              ))}
              {caret && isLast && (
                <span className="ml-1 list-none">
                  <Caret />
                </span>
              )}
            </ul>
          );
        }
        return (
          <p key={bi} className="my-1.5 text-[13px] leading-relaxed text-atlas-ink">
            {lines.map((l, li) => (
              <span key={li}>
                {renderInline(l)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
            {caret && isLast && <Caret />}
          </p>
        );
      })}
    </>
  );
}

// Maps a tool name + args to its inline visual. Used both in part-ordered
// rendering and the history fallback.
function renderTool(toolName: string, args: unknown, key: string): React.ReactNode {
  switch (toolName) {
    case "renderChart":
      return <ChatChart key={key} args={args as ChartArgs} />;
    case "renderTable":
      return <ChatTable key={key} args={args as TableArgs} />;
    case "renderKpiList":
      return <ChatKpi key={key} args={args as KpiArgs} />;
    case "renderDelta":
      return <ChatDelta key={key} args={args as DeltaArgs} />;
    case "renderSparkline":
      return <ChatSparkline key={key} args={args as SparklineArgs} />;
    case "renderHeatmap":
      return <ChatHeatmap key={key} args={args as HeatmapArgs} />;
    case "renderQuadrant":
      return <ChatQuadrant key={key} args={args as QuadrantArgs} />;
    case "renderTimeline":
      return <ChatTimeline key={key} args={args as TimelineArgs} />;
    case "renderWaterfall":
      return <ChatWaterfall key={key} args={args as WaterfallArgs} />;
    default:
      // Silent data tools render as a step row; anything else (truly internal
      // tools) renders nothing.
      return <ChatStep key={key} toolName={toolName} />;
  }
}

function ChatMessageImpl({ message, streaming = false }: { message: Message; streaming?: boolean }) {
  const isUser = message.role === "user";
  // `parts` preserves the model's emission order (text, chart, text, chart…)
  // so each chart sits directly under the commentary that introduces it.
  const parts = !isUser ? message.parts : undefined;

  // Has the assistant produced anything visible yet? While the model is
  // mid-turn, the bubble might already exist with only an invisible
  // tool call (e.g. searchDatasetDocs) and no text — that used to
  // render as a blank white box. Detect it and show a retrieving
  // placeholder instead.
  const invocations = !isUser ? (message.toolInvocations ?? []) : [];
  const hasVisibleTool = invocations.some((inv) => VISIBLE_TOOL_NAMES.has(inv.toolName));
  const hasStep = invocations.some((inv) => inv.toolName in STEP_LABELS);
  const hasText = !!(message.content && message.content.length > 0);
  // Only the truly-blank case (an internal tool in flight, no text/step/chart
  // yet) needs the placeholder; the bottom activity indicator covers the rest.
  const showRetrieving =
    !isUser && !hasText && !hasVisibleTool && !hasStep && invocations.length > 0;

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-sm border px-3.5 py-2.5 ${
          isUser
            ? "border-atlas-ink bg-atlas-ink text-atlas-bg-2"
            : "border-atlas-line bg-atlas-bg-2 text-atlas-ink"
        }`}
      >
        {/* Retrieving placeholder — shown while a silent tool (search /
            snapshot / queryRows) is in flight and no text has streamed
            yet. Hides as soon as text deltas or a visible tool call
            arrive. */}
        {showRetrieving && (
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1.5px] text-atlas-ink-3">
            <Loader2 className="size-3 animate-spin" />
            Retrieving from brief…
          </div>
        )}

        {/* Body. For an assistant turn we walk message.parts in order so a
            multi-chart answer interleaves commentary and charts (text →
            chart → text → chart) instead of stacking all text above all
            charts. Restored history has no parts (the DB stores content +
            tool calls separately, losing interleaving) → fall back to the
            text-then-tools layout. User turns render as plain text. */}
        {!isUser && parts && parts.length > 0 ? (
          parts.map((part, i) => {
            if (part.type === "text") {
              return part.text ? (
                <Prose key={`t-${i}`} text={part.text} caret={streaming && i === parts.length - 1} />
              ) : null;
            }
            if (part.type === "tool-invocation") {
              const inv = part.toolInvocation;
              // Step rows are past-tense ("Read the workbook ✓"), so only show
              // them once the result has landed — until then the present-tense
              // bottom indicator owns the "running" state and the two would
              // otherwise contradict each other. Charts carry their data in
              // args and render at any state.
              if (!VISIBLE_TOOL_NAMES.has(inv.toolName) && inv.state !== "result") {
                return null;
              }
              return renderTool(inv.toolName, inv.args as unknown, inv.toolCallId);
            }
            return null;
          })
        ) : (
          <>
            {message.content && (
              <div className={isUser ? "text-[13px] leading-relaxed" : ""}>
                {isUser ? message.content : <Prose text={message.content} caret={streaming} />}
              </div>
            )}
            {!isUser &&
              message.toolInvocations?.map((inv) =>
                renderTool(inv.toolName, inv.args as unknown, inv.toolCallId),
              )}
          </>
        )}
      </div>
    </div>
  );
}

// During a stream the messages array is rebuilt every throttle tick, but
// only the in-flight assistant message actually changes. Memoizing on the
// fields we render means the stable (already-finished) bubbles skip
// re-rendering — and skip re-parsing their markdown — while tokens stream.
function sameInvocations(a: Message, b: Message): boolean {
  const ia = a.toolInvocations ?? [];
  const ib = b.toolInvocations ?? [];
  if (ia.length !== ib.length) return false;
  for (let i = 0; i < ia.length; i++) {
    if (ia[i].toolCallId !== ib[i].toolCallId || ia[i].state !== ib[i].state) return false;
  }
  return true;
}

export const ChatMessage = memo(
  ChatMessageImpl,
  (prev, next) =>
    prev.streaming === next.streaming &&
    prev.message.id === next.message.id &&
    prev.message.role === next.message.role &&
    prev.message.content === next.message.content &&
    (prev.message.parts?.length ?? 0) === (next.message.parts?.length ?? 0) &&
    sameInvocations(prev.message, next.message),
);
