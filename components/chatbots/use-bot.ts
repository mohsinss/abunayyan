"use client";

import { useChat } from "@ai-sdk/react";
import type { Message } from "ai";
import { useEffect, useRef, useState } from "react";

export type UseBotOptions = {
  initialThreadId?: string;
  initialMessages?: Message[];
  onError?: (_err: Error) => void;
  /**
   * Fires after the server assigns a thread id (first turn of a new
   * conversation). Useful for URL-rewriting new-chat pages from
   * `/chat/new/[slug]` to `/chat/[threadId]`.
   */
  onThreadIdAssigned?: (_threadId: string) => void;
  /**
   * Override the API URL. Default is `/api/v1/chatbots/<slug>/chat`; public
   * share pages pass a token-scoped URL instead. When set, threadId tracking
   * still reads the X-Thread-Id response header (public endpoint just
   * doesn't emit one).
   */
  api?: string;
};

/**
 * React hook that binds any chatbot served by the platform's dynamic route
 * (`POST /api/v1/chatbots/[slug]/chat`). Tracks the server-assigned thread
 * id via the `X-Thread-Id` response header so subsequent turns persist into
 * the same `threads`/`messages` record.
 *
 * All the familiar `useChat` surface is returned (messages, input,
 * handleInputChange, handleSubmit, isLoading, setMessages, setInput, …) plus:
 *   - `threadId`     the current server-assigned thread id, or null before the first turn.
 *   - `resetThread()` clears messages and forgets the thread id so the next turn starts a new one.
 */
export function useBot(slug: string, opts: UseBotOptions = {}) {
  const [threadId, setThreadId] = useState<string | null>(opts.initialThreadId ?? null);
  const threadRef = useRef(threadId);
  threadRef.current = threadId;
  const onAssignedRef = useRef(opts.onThreadIdAssigned);
  useEffect(() => {
    onAssignedRef.current = opts.onThreadIdAssigned;
  }, [opts.onThreadIdAssigned]);

  const chat = useChat({
    api: opts.api ?? `/api/v1/chatbots/${slug}/chat`,
    initialMessages: opts.initialMessages,
    // Batch streamed-chunk re-renders to ~one per 50ms. Without this the
    // message list re-renders (and re-parses markdown) on every token,
    // which is O(n²) work over a streaming reply. 50ms keeps the stream
    // feeling live while collapsing dozens of renders into a few.
    experimental_throttle: 50,
    experimental_prepareRequestBody: ({ messages }) => ({
      messages,
      threadId: threadRef.current ?? undefined,
    }),
    onResponse: (res) => {
      const assigned = res.headers.get("X-Thread-Id");
      if (assigned && assigned !== threadRef.current) {
        setThreadId(assigned);
        onAssignedRef.current?.(assigned);
      }
    },
    onError: opts.onError,
  });

  function resetThread() {
    setThreadId(null);
    chat.setMessages([]);
  }

  return { ...chat, threadId, resetThread };
}
