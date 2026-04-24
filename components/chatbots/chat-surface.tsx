"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Loader2, Trash2 } from "lucide-react";
import type { Message } from "ai";
import { useBot } from "./use-bot";

type ToolPart = NonNullable<Message["toolInvocations"]>[number];

export type ChatSurfaceProps = {
  slug: string;
  title?: string;
  placeholder?: string;
  suggestions?: string[];
  initialThreadId?: string;
  initialMessages?: Message[];
  onThreadIdAssigned?: (_threadId: string) => void;
  className?: string;
};

/**
 * Reusable, neutral-styled chat surface bound to any platform chatbot.
 * Use for generic pages; bespoke experiences (like Atlas) keep their own
 * shell but should still reuse `useBot` internally.
 */
export function ChatSurface({
  slug,
  title,
  placeholder = "Send a message…",
  suggestions = [],
  initialThreadId,
  initialMessages,
  onThreadIdAssigned,
  className,
}: ChatSurfaceProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    resetThread,
  } = useBot(slug, {
    initialThreadId,
    initialMessages,
    onThreadIdAssigned,
    onError: (err) => console.error(`chatbot ${slug} error:`, err),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submitSuggestion(text: string) {
    setInput(text);
    setTimeout(() => {
      document.getElementById(`chat-surface-form-${slug}`)?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    }, 0);
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-md border border-neutral-200 bg-white ${className ?? ""}`}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetThread}
              aria-label="Clear conversation"
              title="Start new conversation"
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </header>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-neutral-500">Try one of these:</p>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submitSuggestion(s)}
                className="rounded-md border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <SurfaceMessage key={m.id} message={m} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="size-3 animate-spin" />
                Thinking…
              </div>
            )}
          </div>
        )}
      </div>

      <form
        id={`chat-surface-form-${slug}`}
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-neutral-200 px-3 py-3"
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
          placeholder={placeholder}
          rows={1}
          style={{ maxHeight: 120 }}
          className="min-h-[38px] flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-900"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          aria-label="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </form>
    </div>
  );
}

function SurfaceMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-md border px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-200 bg-white text-neutral-900"
        }`}
      >
        {message.content && (
          <div className={isUser ? "" : "prose prose-sm max-w-none whitespace-pre-wrap"}>
            {message.content}
          </div>
        )}
        {!isUser &&
          message.toolInvocations?.map((inv) => (
            <ToolInvocationCard key={inv.toolCallId} invocation={inv} />
          ))}
      </div>
    </div>
  );
}

function ToolInvocationCard({ invocation }: { invocation: ToolPart }) {
  const args = invocation.args as Record<string, unknown>;
  const label =
    typeof args?.title === "string" ? args.title : invocation.toolName;
  return (
    <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
      <div className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">
        {invocation.toolName}
      </div>
      <div className="mt-1 font-medium text-neutral-900">{label}</div>
    </div>
  );
}
