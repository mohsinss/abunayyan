"use client";

import { useState } from "react";
import { ArrowUp, Loader2, MessageSquareText, Sparkles, Trash2, X } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { useStickToBottom } from "./use-stick-to-bottom";
import { useBot } from "@/components/chatbots/use-bot";

const SUGGESTIONS = [
  "What is the group CCC and where does it come from?",
  "Which SBU has the longest cash conversion cycle?",
  "Compare ATC vs Citiscape on identified cash release",
  "Why is KSB's working capital so high?",
];

// Dashboard palette (mirrored from /working-capital-data styles.module.css).
// Inlined as colour literals so the chat doesn't need to live inside a
// CSS-module-scoped tree to render correctly when mounted on the
// /working-capital-ccc iframe page.
const NAVY_1 = "#0b3378";
const NAVY_2 = "#2964a9";
const NAVY_3 = "#418cc0";
const INK = "#1a2233";
const INK_SOFT = "#4a5568";
const SURFACE = "#ffffff";
const BG = "#f4f6fb";
const LINE = "#e3e8f1";

export function WorkingCapitalChat() {
  const [open, setOpen] = useState(false);
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    resetThread,
  } = useBot("working-capital-analyst", {
    onError: (err) => console.error("Working Capital chat error:", err),
  });

  // Sticks to the bottom while streaming, releases when the user scrolls up.
  const { ref: scrollRef } = useStickToBottom(messages, open);

  const submitSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => {
      document.getElementById("working-capital-chat-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    }, 0);
  };

  return (
    <>
      {/* keyframes for the indeterminate header progress bar */}
      <style jsx global>{`
        @keyframes wcChatBarSlide {
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
          aria-label="Open Working Capital analyst"
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
            Ask Working Capital Analyst
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex h-[min(720px,calc(100dvh-3rem))] w-[min(480px,calc(100vw-3rem))] flex-col rounded-lg shadow-2xl"
          style={{
            background: SURFACE,
            border: `1px solid ${LINE}`,
            boxShadow: "0 16px 40px rgba(11,51,120,0.22)",
          }}
        >
          {/* HEADER */}
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
                  Working Capital{" "}
                  <em className="italic" style={{ color: NAVY_2 }}>
                    Analyst
                  </em>
                </div>
                <div
                  className="mt-0.5 font-mono text-[9px] uppercase tracking-[1.2px]"
                  style={{ color: INK_SOFT }}
                >
                  FY-2025 brief · vector-retrieved answers
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={resetThread}
                  aria-label="Clear chat"
                  className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-[#f0f6fd]"
                  style={{ color: INK_SOFT }}
                  title="Start new conversation"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
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

            {/* Indeterminate progress bar — visible only while the model
                is still streaming (or running a tool). Sits flush with
                the header bottom border. */}
            {isLoading && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
                aria-hidden
              >
                <div
                  className="absolute inset-y-0 w-1/4"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${NAVY_3} 20%, ${NAVY_2} 50%, ${NAVY_3} 80%, transparent)`,
                    animation: "wcChatBarSlide 1.1s ease-in-out infinite",
                  }}
                />
              </div>
            )}
          </div>

          {/* MESSAGE PANE */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{
              background: BG,
              backgroundImage:
                `radial-gradient(circle at 50% 0%, rgba(65,140,192,0.08) 0%, transparent 55%)`,
            }}
          >
            {messages.length === 0 ? (
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
                      Ask the brief
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: INK_SOFT }}>
                    I retrieve passages from the FY-2025 Working Capital &amp; CCC brief and
                    answer with the cited figures. Try one of these, or ask your own.
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
                    Retrieving…
                  </div>
                )}
              </div>
            )}
          </div>

          {/* COMPOSER */}
          <form
            id="working-capital-chat-form"
            onSubmit={handleSubmit}
            className="flex items-end gap-2 px-3 py-3"
            style={{
              background: SURFACE,
              borderTop: `1px solid ${LINE}`,
            }}
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
              placeholder="Ask about an SBU, CCC, DSO, or the cash-release plan…"
              rows={1}
              className="min-h-[38px] flex-1 resize-none rounded-md px-3 py-2 font-sans text-[13px] outline-none focus:outline-none"
              style={{
                background: BG,
                border: `1px solid ${LINE}`,
                color: INK,
                maxHeight: 120,
              }}
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
