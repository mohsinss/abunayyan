import type { AiProvider, ModelId } from "@/db/schema/chatbots";

type Pricing = { inputPer1K: number; outputPer1K: number };

const PRICING: Record<ModelId, Pricing> = {
  "claude-opus-4-7":           { inputPer1K: 0.015,   outputPer1K: 0.075 },
  "claude-sonnet-4-6":         { inputPer1K: 0.003,   outputPer1K: 0.015 },
  "claude-haiku-4-5-20251001": { inputPer1K: 0.0008,  outputPer1K: 0.004 },
  "gpt-4o":                    { inputPer1K: 0.0025,  outputPer1K: 0.01 },
  "gpt-4o-mini":               { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  "o3-mini":                   { inputPer1K: 0.0011,  outputPer1K: 0.0044 },
  "gemini-2.5-pro":            { inputPer1K: 0.00125, outputPer1K: 0.005 },
  "gemini-2.5-flash":          { inputPer1K: 0.000075,outputPer1K: 0.0003 },
  "grok-2":                    { inputPer1K: 0.002,   outputPer1K: 0.01 },
  "grok-beta":                 { inputPer1K: 0.005,   outputPer1K: 0.015 },
};

export function estimateCostUsd(
  _provider: AiProvider,
  modelId: ModelId | string,
  usage: { promptTokens: number; completionTokens: number },
): number {
  const p = PRICING[modelId as ModelId];
  if (!p) return 0;
  return (
    (usage.promptTokens / 1000) * p.inputPer1K +
    (usage.completionTokens / 1000) * p.outputPer1K
  );
}
