import "server-only";
import { type Tool } from "ai";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getToolsForBot } from "../index";
import type { Chatbot } from "@/db/schema/chatbots";
import type { UserRole } from "@/db/schema/users";

// Anthropic tool definition, per the Messages API spec:
//   { name, description, input_schema: JSONSchema }
// We don't import @anthropic-ai/sdk's Tool type here to keep the
// adapter usable in unit tests without instantiating the SDK.
export type AnthropicToolSchema = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

// Result of converting a bot's resolved Vercel AI SDK tool map into a
// shape the Anthropic Messages API can consume, plus an executor the
// runtime calls when the model emits tool_use blocks.
export type AnthropicToolBundle = {
  schemas: AnthropicToolSchema[];
  // Runs the named tool with the given parsed input. Return value is
  // serialised to a string and sent back as the tool_result content.
  execute: (_name: string, _input: unknown) => Promise<unknown>;
};

// Drop the JSON Schema $schema / definitions keys the Anthropic API
// rejects, and ensure the top-level is shaped as object{properties}.
function normaliseInputSchema(raw: unknown): AnthropicToolSchema["input_schema"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  const props = (r.properties as Record<string, unknown>) ?? {};
  const required = Array.isArray(r.required) ? (r.required as string[]) : undefined;
  return {
    type: "object",
    properties: props,
    ...(required && required.length ? { required } : {}),
    additionalProperties: false,
  };
}

// Builds the schemas array + executor closure from the bot's tool list.
// Reuses the existing tool registry and contexts (userId, datasetId,
// threadId) so tools behave identically across all engines.
export function buildAnthropicTools(
  bot: Pick<Chatbot, "id" | "tools">,
  user: { id: string; role: UserRole; disabled: boolean },
  threadId: string,
  datasetId: string | null,
): AnthropicToolBundle {
  const tools = getToolsForBot(bot, user, threadId, datasetId);
  const schemas: AnthropicToolSchema[] = [];
  const executors = new Map<string, Tool>();

  for (const [name, t] of Object.entries(tools)) {
    executors.set(name, t);
    const params = (t as Tool & { parameters?: z.ZodTypeAny }).parameters;
    const json = params ? zodToJsonSchema(params, { target: "openApi3" }) : { properties: {} };
    schemas.push({
      name,
      description: t.description ?? "",
      input_schema: normaliseInputSchema(json),
    });
  }

  return {
    schemas,
    execute: async (name, input) => {
      const t = executors.get(name);
      if (!t) {
        return { error: "unknown_tool", message: `No tool registered for "${name}"` };
      }
      // The AI SDK tool's execute is async and may throw; we surface
      // errors as tool_result content with is_error=true upstream.
      const exec = (t as Tool & {
        execute?: (_args: unknown, _opts: { toolCallId: string; messages: [] }) => Promise<unknown>;
      }).execute;
      if (!exec) return { error: "no_execute", message: `Tool "${name}" has no execute function` };
      return exec(input, { toolCallId: `${name}-direct`, messages: [] });
    },
  };
}
