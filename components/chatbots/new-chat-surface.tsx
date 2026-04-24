"use client";

import { useRouter } from "next/navigation";
import { ChatSurface, type ChatSurfaceProps } from "./chat-surface";

/**
 * Wraps ChatSurface for the "new conversation" flow. Once the server assigns
 * a thread id (after the first turn), navigates to `/chat/[threadId]` so the
 * URL reflects the conversation and subsequent refreshes rehydrate from DB.
 */
export function NewChatSurface(props: Omit<ChatSurfaceProps, "initialThreadId" | "onThreadIdAssigned">) {
  const router = useRouter();
  return (
    <ChatSurface
      {...props}
      onThreadIdAssigned={(tid) => {
        // Replace so Back goes to /chat, not back to /chat/new/[slug].
        router.replace(`/chat/${tid}`);
      }}
    />
  );
}
