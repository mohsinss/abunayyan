"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Maximize2,
  MessageSquareText,
  Minimize2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { Message } from "ai";
import { ChatMessage } from "./chat-message";
import { useStickToBottom } from "./use-stick-to-bottom";
import { useBot } from "@/components/chatbots/use-bot";

const BOT_SLUG = "wc-intelligence-analyst";
// Thread id survives refreshes; cleared only by the header reset button.
const THREAD_KEY = "wcx-chat-thread";

type StoredMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }> | null;
  // Ordered text/tool parts as they streamed (text → chart → text → chart).
  parts?: Message["parts"] | null;
};

// DB message → useChat UIMessage. Stored tool calls are promoted to
// state:'result' invocations (render tools are pass-through, so
// args === result) which makes charts/tables re-render after a refresh.
function toUiMessage(m: StoredMessage): Message {
  const stored = Array.isArray(m.toolCalls) ? m.toolCalls : [];
  const toolInvocations = stored
    .filter((c) => c && typeof c === "object" && "toolCallId" in c)
    .map((c) => ({
      state: "result" as const,
      toolCallId: c.toolCallId,
      toolName: c.toolName,
      args: c.args,
      result: c.args,
    }));
  return {
    id: m.id,
    role: m.role as Message["role"],
    content: m.content,
    createdAt: new Date(m.createdAt),
    ...(toolInvocations.length > 0 ? { toolInvocations } : {}),
    // Restore the streamed order so a refreshed conversation keeps its
    // chat → chart → chat → chart interleaving. The renderer prefers
    // `parts` over content+toolInvocations; without this the bubble falls
    // back to all-text-then-all-charts even though the live stream was right.
    ...(Array.isArray(m.parts) && m.parts.length > 0 ? { parts: m.parts } : {}),
  };
}

const SUGGESTIONS = [
  "Which SBU has the longest cash conversion cycle right now?",
  "Show the group NWC trend over the last 12 months",
  "Compare FY-2025 revenue vs FY-2024 across all SBUs",
  "Which SBU deteriorated most in CCC this year?",
  "How far is each SBU from its DSO target?",
];

// Same navy palette as the working-capital brief (styles.module.css),
// inlined so the bubble renders identically wherever it's mounted.
const NAVY_1 = "#0b3378";
const NAVY_2 = "#2964a9";
const NAVY_3 = "#418cc0";
const INK = "#1a2233";
const INK_SOFT = "#4a5568";
const SURFACE = "#ffffff";
const BG = "#f4f6fb";
const LINE = "#e3e8f1";

export function WcxChat() {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Read once on mount; null during SSR (doesn't affect initial markup).
  const initialThread = useMemo(
    () => (typeof window === "undefined" ? null : localStorage.getItem(THREAD_KEY)),
    [],
  );

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    setMessages,
    resetThread,
    failed,
    retry,
    error,
  } = useBot(BOT_SLUG, {
    initialThreadId: initialThread ?? undefined,
    onThreadIdAssigned: (id) => localStorage.setItem(THREAD_KEY, id),
    onError: (err) => console.error("WC Intelligence chat error:", err),
  });

  // Restore the persisted conversation after a refresh.
  useEffect(() => {
    if (!initialThread) return;
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`/api/v1/chatbots/${BOT_SLUG}/threads/${initialThread}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`history ${res.status}`);
        const body = (await res.json()) as { messages?: StoredMessage[] };
        if (cancelled) return;
        const restored = (body.messages ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map(toUiMessage);
        if (restored.length > 0) setMessages(restored);
      })
      .catch(() => {
        // Thread vanished (deleted/archived) — forget it.
        if (!cancelled) localStorage.removeItem(THREAD_KEY);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReset = () => {
    localStorage.removeItem(THREAD_KEY);
    resetThread();
  };

  const panelRef = useRef<HTMLDivElement>(null);
  // Sticks to the bottom while streaming, releases when the user scrolls up.
  const { ref: scrollRef } = useStickToBottom(messages, open);

  // Click-away closes the panel. The chart modal lives inside the panel's
  // DOM tree, so interacting with it never counts as outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const submitSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => {
      document
        .getElementById("wcx-chat-form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }, 0);
  };

  return (
    <>
      <style jsx global>{`
        @keyframes wcxChatBarSlide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
      `}</style>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open WC Intelligence analyst"
          className="group fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${NAVY_1}, ${NAVY_2} 60%, ${NAVY_3})`,
            boxShadow: "0 8px 24px rgba(11,51,120,0.32)",
          }}
        >
          <Sparkles className="size-6" />
          <span
            className="absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-md border bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.2px] shadow-md group-hover:block"
            style={{ borderColor: LINE, color: NAVY_1 }}
          >
            Ask WC Intelligence
          </span>
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-lg shadow-2xl transition-[width,height] duration-200 ${
            wide
              ? "h-[min(840px,calc(100dvh-3rem))] w-[min(920px,calc(100vw-3rem))]"
              : "h-[min(720px,calc(100dvh-3rem))] w-[min(480px,calc(100vw-3rem))]"
          }`}
          style={{
            background: SURFACE,
            border: `1px solid ${LINE}`,
            boxShadow: "0 16px 40px rgba(11,51,120,0.22)",
          }}
        >
          <div
            className="relative flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid ${LINE}` }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex size-8 items-center justify-center rounded-md text-white"
                style={{
                  background: `linear-gradient(135deg, ${NAVY_1}, ${NAVY_3})`,
                  boxShadow: `0 4px 12px rgba(11,51,120,0.22)`,
                }}
              >
                <Sparkles className="size-4" />
              </div>
              <div>
                <div
                  className="font-serif text-[15px] font-medium leading-none"
                  style={{ color: INK }}
                >
                  WC{" "}
                  <em className="italic" style={{ color: NAVY_2 }}>
                    Intelligence
                  </em>
                </div>
                <div
                  className="mt-0.5 font-mono text-[9px] uppercase tracking-[1.2px]"
                  style={{ color: INK_SOFT }}
                >
                  exact figures · from the active workbook
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  aria-label="Reset conversation"
                  className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-[#f0f6fd]"
                  style={{ color: INK_SOFT }}
                  title="Reset conversation (clears saved history)"
                >
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setWide((w) => !w)}
                aria-label={wide ? "Restore size" : "Enlarge"}
                className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-[#f0f6fd]"
                style={{ color: INK_SOFT }}
                title={wide ? "Restore size" : "Enlarge"}
              >
                {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-[#f0f6fd]"
                style={{ color: INK_SOFT }}
              >
                <X className="size-4" />
              </button>
            </div>

            {isLoading && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
                aria-hidden
              >
                <div
                  className="absolute inset-y-0 w-1/4"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${NAVY_3} 20%, ${NAVY_2} 50%, ${NAVY_3} 80%, transparent)`,
                    animation: "wcxChatBarSlide 1.1s ease-in-out infinite",
                  }}
                />
              </div>
            )}
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{
              background: BG,
              backgroundImage: `radial-gradient(circle at 50% 0%, rgba(65,140,192,0.08) 0%, transparent 55%)`,
            }}
          >
            {historyLoading && messages.length === 0 ? (
              <div
                className="flex h-full items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[1.5px]"
                style={{ color: INK_SOFT }}
              >
                <Loader2 className="size-3 animate-spin" />
                Restoring conversation…
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-start justify-end gap-4">
                <div
                  className="rounded-md px-4 py-3.5"
                  style={{
                    background: SURFACE,
                    border: `1px solid ${LINE}`,
                    boxShadow: "0 1px 2px rgba(11,51,120,0.04)",
                  }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <MessageSquareText className="size-4" style={{ color: NAVY_3 }} />
                    <span className="font-serif text-[14px] font-medium" style={{ color: INK }}>
                      Ask the workbook
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: INK_SOFT }}>
                    Every number I quote is read or computed deterministically from the active
                    workbook upload — no estimates. Ask for figures, trends, comparisons, or
                    target gaps.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 self-stretch">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submitSuggestion(s)}
                      className="rounded-md px-3 py-2 text-left text-[12.5px] transition-colors"
                      style={{
                        background: SURFACE,
                        border: `1px solid ${LINE}`,
                        color: INK_SOFT,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = NAVY_3;
                        e.currentTarget.style.color = NAVY_1;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = LINE;
                        e.currentTarget.style.color = INK_SOFT;
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    streaming={isLoading && i === messages.length - 1 && m.role === "assistant"}
                  />
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div
                    className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1.5px]"
                    style={{ color: INK_SOFT }}
                  >
                    <Loader2 className="size-3 animate-spin" />
                    Querying workbook…
                  </div>
                )}
                {failed && !isLoading && (
                  <div className="flex items-center justify-between gap-3 rounded-sm border border-[#f3c4be] bg-[#fdeeec] px-3 py-2 text-[12px] text-[#b03a2e]">
                    <span className="min-w-0 break-words">
                      {error?.message
                        ? `Couldn't finish: ${error.message}`
                        : "The response didn't finish — it may have timed out mid-analysis."}
                    </span>
                    <button
                      type="button"
                      onClick={retry}
                      className="shrink-0 rounded-sm border border-[#b03a2e]/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[1px] transition hover:bg-[#b03a2e]/10"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <form
            id="wcx-chat-form"
            onSubmit={handleSubmit}
            className="flex items-end gap-2 px-3 py-3"
            style={{ background: SURFACE, borderTop: `1px solid ${LINE}` }}
          >
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Ask for any figure, trend, or comparison…"
              rows={1}
              className="min-h-[38px] flex-1 resize-none rounded-md px-3 py-2 font-sans text-[13px] outline-none focus:outline-none"
              style={{ background: BG, border: `1px solid ${LINE}`, color: INK, maxHeight: 120 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = NAVY_3)}
              onBlur={(e) => (e.currentTarget.style.borderColor = LINE)}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send"
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: `linear-gradient(135deg, ${NAVY_1}, ${NAVY_2})`,
                boxShadow: "0 4px 12px rgba(11,51,120,0.22)",
              }}
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
