"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { ChatMessage } from "../chat/chat-message";
import { useBot } from "@/components/chatbots/use-bot";

// Floating editorial chat bubble for any per-card chatbot. Same chrome as
// components/dashboard/chat/atlas-chat.tsx but parameterised: pass the
// chatbot slug, dataset title, and optional starter prompts. Dataset cards
// drop one of these in instead of linking out to /dashboard/<slug>/chat.
export function AtlasCardChat({
  botSlug,
  datasetTitle,
  suggestions,
}: {
  botSlug: string;
  datasetTitle: string;
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    resetThread,
  } = useBot(botSlug, {
    onError: (err) => console.error(`card chat ${botSlug} error:`, err),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const formId = `card-chat-form-${botSlug}`;
  const submitSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => {
      document
        .getElementById(formId)
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }, 0);
  };

  const starters =
    suggestions && suggestions.length > 0
      ? suggestions
      : [
          `What's in ${datasetTitle}?`,
          "Summarise the data in 3 bullets",
          "What are the top values?",
          "Are there any outliers worth flagging?",
        ];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${datasetTitle} assistant`}
          className="group fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-atlas-ink text-atlas-bg-2 shadow-lg transition-all hover:scale-105 hover:bg-atlas-gold hover:shadow-xl"
          style={{ boxShadow: "0 8px 24px rgba(139, 111, 46, 0.25)" }}
        >
          <Sparkles className="size-6" />
          <span className="absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-sm border border-atlas-line bg-atlas-bg-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink shadow-md group-hover:block">
            Ask about this card
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex h-[min(720px,calc(100dvh-3rem))] w-[min(480px,calc(100vw-3rem))] flex-col rounded-sm border border-atlas-line bg-atlas-bg-2 shadow-2xl"
          style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}
        >
          <div className="flex items-center justify-between border-b border-atlas-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-sm bg-atlas-ink text-atlas-bg-2">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-serif text-[15px] font-medium leading-none text-atlas-ink">
                  {datasetTitle}{" "}
                  <em className="italic text-atlas-gold">Assistant</em>
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1.2px] text-atlas-ink-3">
                  Scoped to this card&apos;s data
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={resetThread}
                  aria-label="Clear chat"
                  className="flex size-8 items-center justify-center rounded-sm text-atlas-ink-3 hover:bg-atlas-bg-3 hover:text-atlas-ink"
                  title="Start new conversation"
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
                  <div className="font-serif text-[14px] leading-snug text-atlas-ink">
                    Ask about <em className="italic text-atlas-gold">{datasetTitle}</em>. I can
                    pull rows, run aggregations, and search the documents you uploaded.
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submitSuggestion(s)}
                      className="rounded-sm border border-atlas-line bg-atlas-bg-2 px-3 py-1.5 text-left font-sans text-[12px] text-atlas-ink-2 transition-colors hover:border-atlas-gold hover:bg-atlas-gold-soft hover:text-atlas-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} />
                ))}
                {isLoading ? (
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink-3">
                    <Loader2 className="size-3 animate-spin" />
                    Thinking…
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form
            id={formId}
            onSubmit={handleSubmit}
            className="flex items-end gap-2 border-t border-atlas-line bg-atlas-bg-2 px-3 py-3"
          >
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  document
                    .getElementById(formId)
                    ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                }
              }}
              rows={1}
              placeholder="Ask anything about this card…"
              className="flex-1 resize-none rounded-sm border border-atlas-line bg-atlas-bg px-2.5 py-2 font-sans text-[13px] text-atlas-ink outline-none placeholder:text-atlas-ink-3 focus:border-atlas-gold"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send"
              className="flex size-9 items-center justify-center rounded-sm bg-atlas-ink text-atlas-bg-2 transition-colors hover:bg-atlas-gold disabled:cursor-not-allowed disabled:bg-atlas-line-2"
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
