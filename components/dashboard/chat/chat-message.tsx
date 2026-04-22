"use client";

import { type Message } from "ai";
import { ChatChart, type ChartArgs } from "./chat-chart";
import { ChatTable, type TableArgs } from "./chat-table";
import { ChatKpi, type KpiArgs } from "./chat-kpi";

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

function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="my-2 ml-4 list-disc space-y-1 text-[13px] leading-relaxed">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-•]\s+/, ""))}</li>
              ))}
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
          </p>
        );
      })}
    </>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-sm border px-3.5 py-2.5 ${
          isUser
            ? "border-atlas-ink bg-atlas-ink text-atlas-bg-2"
            : "border-atlas-line bg-atlas-bg-2 text-atlas-ink"
        }`}
      >
        {/* Text content */}
        {message.content && (
          <div className={isUser ? "text-[13px] leading-relaxed" : ""}>
            {isUser ? message.content : <Prose text={message.content} />}
          </div>
        )}

        {/* Tool invocations — render each chart/table inline */}
        {!isUser &&
          message.toolInvocations?.map((inv) => {
            // The model's args are available immediately (state='call'),
            // the full result comes when execute finishes (state='result').
            // Since our execute is a pass-through, args === result.
            const args = inv.args as unknown;
            if (inv.toolName === "renderChart") {
              return <ChatChart key={inv.toolCallId} args={args as ChartArgs} />;
            }
            if (inv.toolName === "renderTable") {
              return <ChatTable key={inv.toolCallId} args={args as TableArgs} />;
            }
            if (inv.toolName === "renderKpiList") {
              return <ChatKpi key={inv.toolCallId} args={args as KpiArgs} />;
            }
            return null;
          })}
      </div>
    </div>
  );
}
