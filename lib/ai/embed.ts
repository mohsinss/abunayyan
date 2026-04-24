import "server-only";
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const model = openai.embedding("text-embedding-3-small");

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model, value: text });
  return embedding;
}

// Batch-embed many texts in one API call. OpenAI accepts up to 2048 inputs;
// we batch in chunks of 96 to keep request payloads modest and stay under
// per-call token budgets (small-ish chunks * many = fine).
const BATCH_SIZE = 96;

export async function embedTextMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({ model, values: slice });
    out.push(...embeddings);
  }
  return out;
}
