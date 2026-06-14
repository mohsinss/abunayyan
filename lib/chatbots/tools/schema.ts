import { z } from "zod";

// Render tools must be FORGIVING of the model's output: a label that runs a
// few characters long should be trimmed to fit, never hard-reject the whole
// tool call (which surfaces as "Invalid arguments for tool …" and a chart
// that silently fails to render). `clampedString` truncates past `max`
// instead of throwing, so a visualization always renders. Tool descriptions
// still steer the model toward short labels; this is just the safety net.
//
// Note: the truncation happens during schema parse (AI SDK validates tool
// args before execute), so the downstream component receives the clamped
// value. Targets are generous — truncation should be rare and only cosmetic.
export function clampedString(max: number) {
  return z
    .string()
    .transform((s) => (s.length > max ? s.slice(0, max).trimEnd() : s));
}
