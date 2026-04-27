import "server-only";
import type { UIMessage } from "ai";

// Anthropic Messages API content block shapes. We only model the
// subset we actually emit/consume — text, tool_use, tool_result.
// Reference: https://platform.claude.com/docs/en/api/messages/create
export type AnthropicTextBlock = { type: "text"; text: string };
export type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};
export type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

// Pulls just the assistant's tool invocations from a UIMessage. The
// AI SDK accumulates these on the message as `toolInvocations` once
// the tool result has come back. We need them to reconstruct the
// assistant turn for Anthropic's history.
type ToolInvocation = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  state: "call" | "result" | "partial-call";
  result?: unknown;
};

function getToolInvocations(m: UIMessage): ToolInvocation[] {
  const raw = (m as UIMessage & { toolInvocations?: unknown[] }).toolInvocations;
  if (!Array.isArray(raw)) return [];
  return raw as ToolInvocation[];
}

// Convert the UI-facing message stream into the format Anthropic
// expects on a Messages API call. Specifically:
//   - System messages are stripped (system goes top-level on the
//     request, never inside `messages`).
//   - User string content stays as a string.
//   - Assistant text+tools fan out into a content-block array
//     containing one text block (when present) plus one tool_use
//     block per invocation.
//   - For each completed tool invocation on an assistant message,
//     a follow-up `user` message with a `tool_result` block is
//     emitted so Anthropic sees the tool round-trip in history.
export function toAnthropicMessages(messages: UIMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "user") {
      const text = typeof m.content === "string" ? m.content : "";
      if (text) out.push({ role: "user", content: text });
      continue;
    }

    if (m.role === "assistant") {
      const tools = getToolInvocations(m);
      const blocks: AnthropicContentBlock[] = [];
      const text = typeof m.content === "string" ? m.content : "";
      if (text) blocks.push({ type: "text", text });
      for (const inv of tools) {
        blocks.push({
          type: "tool_use",
          id: inv.toolCallId,
          name: inv.toolName,
          input: inv.args ?? {},
        });
      }
      if (blocks.length === 0) continue;
      out.push({ role: "assistant", content: blocks });

      // Emit the tool_result follow-ups (as user-role messages) for
      // every invocation that has resolved.
      const resultBlocks: AnthropicToolResultBlock[] = [];
      for (const inv of tools) {
        if (inv.state !== "result") continue;
        resultBlocks.push({
          type: "tool_result",
          tool_use_id: inv.toolCallId,
          content: stringifyResult(inv.result),
        });
      }
      if (resultBlocks.length > 0) {
        out.push({ role: "user", content: resultBlocks });
      }
    }
  }

  // Anthropic requires the message list to end with a user message,
  // and disallows two consecutive same-role messages. The UIMessage
  // input always ends with the latest user prompt, so we don't need
  // extra rewriting in the typical case.
  return out;
}

function stringifyResult(r: unknown): string {
  if (r == null) return "";
  if (typeof r === "string") return r;
  try {
    return JSON.stringify(r);
  } catch {
    return String(r);
  }
}
