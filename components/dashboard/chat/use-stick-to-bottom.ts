"use client";

import { useCallback, useEffect, useRef } from "react";

// Auto-scroll that "sticks" to the bottom while content streams in, but
// releases the moment the user scrolls up to read — and re-engages when they
// scroll back down. Uses instant scrollTop assignment (not smooth-behavior)
// so rapid streaming updates don't stack competing scroll animations, which
// is what makes naive `scrollTo({ behavior: "smooth" })` feel janky.
export function useStickToBottom<T>(dep: T, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stuck.current = distanceFromBottom < 80; // within 80px of the bottom
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [dep, enabled]);

  // Force a stick (e.g. when the user sends a new message or the panel opens).
  const scrollToBottom = useCallback(() => {
    stuck.current = true;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  return { ref, scrollToBottom };
}
