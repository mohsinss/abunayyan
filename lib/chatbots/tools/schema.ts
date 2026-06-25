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

// Same forgiveness for arrays: the model occasionally overshoots a list cap
// (e.g. a full snapshot crammed into one KPI card). A hard `.max()` rejects
// the WHOLE tool call ("Invalid arguments for tool …"), which on the AI SDK
// path kills the turn outright. `clampedArray` truncates past `max` during
// parse instead of throwing, so the visual always renders with the first
// `max` items. `min` is still enforced (a sub-min/empty list is a genuine
// error worth a retry, and is rare) — on the direct engine that surfaces as a
// recoverable tool_result error, not a dead turn.
export function clampedArray<T extends z.ZodTypeAny>(
  item: T,
  { min = 1, max }: { min?: number; max: number },
) {
  return z
    .array(item)
    .min(min)
    .transform((a) => (a.length > max ? a.slice(0, max) : a));
}

// Enums are the single biggest hard-reject risk: the model hallucinates a
// tone/type/palette word and the whole tool call is rejected. `tolerantEnum`
// falls back to a safe in-vocab default for any off-vocab value instead of
// throwing — the same hardening `render-kpi.ts` already applies to `tone`.
export function tolerantEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) {
  // Cast preserves the literal element union (T[number]) so downstream
  // `z.infer` stays narrow (e.g. "navy" | "diverging"), not widened to string.
  return z.enum(values as unknown as [T[number], ...T[number][]]).catch(fallback);
}
