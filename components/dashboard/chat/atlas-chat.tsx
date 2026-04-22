"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, MessageSquareText, Sparkles, Trash2, X } from "lucide-react";
import { ChatMessage } from "./chat-message";

const SUGGESTIONS = [
  "What is Wetico's financial position?",
  "Which entities are AI rescue candidates?",
  "Compare ATC vs Citiscape on SLA burden",
  "How is ICT's 56.6M budget distributed?",
];

export function AtlasChat() {
  const [open, setOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, setInput } =
    useChat({
      api: "/api/v1/ai/atlas-chat",
      onError: (err) => console.error("Atlas chat error:", err),
    });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const submitSuggestion = (text: string) => {
    setInput(text);
    // Submit on next tick so the controlled input reflects the value.
    setTimeout(() => {
      document.getElementById("atlas-chat-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    }, 0);
  };

  return (
    <>
      {/* Floating bubble — always visible */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open atlas analyst"
          className="group fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-atlas-ink text-atlas-bg-2 shadow-lg transition-all hover:scale-105 hover:bg-atlas-gold hover:shadow-xl"
          style={{ boxShadow: "0 8px 24px rgba(139, 111, 46, 0.25)" }}
        >
          <Sparkles className="size-6" />
          <span className="absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-sm border border-atlas-line bg-atlas-bg-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink shadow-md group-hover:block">
            Ask Atlas Analyst
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex h-[min(720px,calc(100dvh-3rem))] w-[min(480px,calc(100vw-3rem))] flex-col rounded-sm border border-atlas-line bg-atlas-bg-2 shadow-2xl"
          style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-atlas-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-sm bg-atlas-ink text-atlas-bg-2">
                <Sparkles className="size-4" />
              </div>
              <div>
                <div className="font-serif text-[15px] font-medium leading-none text-atlas-ink">
                  Atlas <em className="italic text-atlas-gold">Analyst</em>
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1.2px] text-atlas-ink-3">
                  FY2026 · Ask anything about the data
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  aria-label="Clear chat"
                  className="flex size-8 items-center justify-center rounded-sm text-atlas-ink-3 hover:bg-atlas-bg-3 hover:text-atlas-ink"
                  title="Clear conversation"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-sm text-atlas-ink-3 hover:bg-atlas-bg-3 hover:text-atlas-ink"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-atlas-bg px-4 py-4"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 0%, rgba(139,111,46,0.04) 0%, transparent 50%)",
            }}
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-start justify-end gap-4">
                <div className="rounded-sm border border-atlas-line bg-atlas-bg-2 px-4 py-3.5">
                  <div className="mb-1 flex items-center gap-2">
                    <MessageSquareText className="size-4 text-atlas-gold" />
                    <span className="font-serif text-[14px] font-medium text-atlas-ink">
                      Ready when you are
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-atlas-ink-2">
                    I have the full FY2026 data for all 14 entities, 15 HQ departments, and the SLA
                    allocation matrix. I can render charts, tables, and KPI cards inline. Try one of
                    these, or type your own question.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 self-stretch">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submitSuggestion(s)}
                      className="rounded-sm border border-atlas-line bg-atlas-bg-2 px-3 py-2 text-left text-[12.5px] text-atlas-ink-2 transition-colors hover:border-atlas-gold hover:bg-atlas-gold-soft hover:text-atlas-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} />
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1.5px] text-atlas-ink-3">
                    <Loader2 className="size-3 animate-spin" />
                    Analyzing…
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            id="atlas-chat-form"
            onSubmit={handleSubmit}
            className="flex items-end gap-2 border-t border-atlas-line bg-atlas-bg-2 px-3 py-3"
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
              placeholder="Ask about an entity, a department, a comparison…"
              rows={1}
              className="min-h-[38px] flex-1 resize-none rounded-sm border border-atlas-line bg-atlas-bg px-3 py-2 font-sans text-[13px] text-atlas-ink outline-none placeholder:text-atlas-ink-3 focus:border-atlas-gold"
              style={{ maxHeight: 120 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send"
              className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-atlas-ink text-atlas-bg-2 transition-all hover:bg-atlas-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
