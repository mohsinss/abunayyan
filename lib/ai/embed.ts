import "server-only";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

const model = openai.embedding("text-embedding-3-small");

export async function embedText(text: string) {
  const { embedding } = await embed({ model, value: text });
  return embedding;
}
