import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

export const models = {
  default: anthropic("claude-sonnet-4-6"),
  smart: anthropic("claude-opus-4-7"),
  cheap: anthropic("claude-haiku-4-5"),
  openaiFallback: openai("gpt-4o"),
  openaiCheap: openai("gpt-4o-mini"),
} as const;

export type ModelKey = keyof typeof models;
