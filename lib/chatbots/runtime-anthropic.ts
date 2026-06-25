import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createDataStreamResponse, formatDataStreamPart, type UIMessage } from "ai";
import type { Chatbot } from "@/db/schema/chatbots";
import type { UserRole } from "@/db/schema/users";
import { env } from "@/lib/env";
import { captureError } from "@/lib/logger";
import { recordTurnEnd, type FinishReason, type RuntimeStream } from "./runtime-shared";
import {
  buildAnthropicTools,
  type AnthropicToolBundle,
} from "./tools/adapters/anthropic";
import {
  toAnthropicMessages,
  type AnthropicContentBlock,
  type AnthropicMessage,
  type AnthropicToolResultBlock,
  type AnthropicToolUseBlock,
} from "./tools/adapters/anthropic-messages";

// Direct-Anthropic runtime. Uses @anthropic-ai/sdk for the Messages
// API call and streaming events; we orchestrate the multi-step tool
// loop ourselves and emit the Vercel DataStream wire format so the
// existing client (useChat) keeps working unchanged.
//
// Reference docs:
//   - https://platform.claude.com/docs/en/api/messages/create
//   - https://platform.claude.com/docs/en/api/sdks/typescript
//   - https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set; anthropic_direct engine cannot run");
  }
  cachedClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cachedClient;
}

// Maps Anthropic stop_reason values to the AI-SDK FinishReason vocab
// used by recordTurnEnd. The DB column is a free-form varchar(32) so
// any of these values is fine.
function toFinishReason(stop: string | null | undefined): FinishReason {
  switch (stop) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool-calls";
    default:
      return "unknown";
  }
}

type CollectedToolUse = {
  index: number;
  id: string;
  name: string;
  partialJson: string;
};

type StepCollected = {
  text: string;
  toolUses: CollectedToolUse[];
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
};

// Drive one round-trip with the Anthropic API and collect what came
// back. Streams text deltas to the data stream as they arrive so the
// client sees live tokens. Tool-use blocks are buffered: we only emit
// them once their input JSON has fully arrived (Anthropic chunks
// `input_json_delta` events for the partial JSON).
async function runStep(
  client: Anthropic,
  args: {
    model: string;
    system: string;
    temperature: number;
    maxTokens: number;
    messages: AnthropicMessage[];
    tools: AnthropicToolBundle["schemas"];
    onText: (_delta: string) => void;
  },
): Promise<StepCollected> {
  const { model, system, temperature, maxTokens, messages, tools, onText } = args;

  // Prompt caching: mark the system prompt as an ephemeral cache
  // breakpoint. Anthropic caches the prompt prefix up to the breakpoint,
  // and the prefix order is tools → system → messages, so this single
  // breakpoint caches BOTH the tool schemas and the system prompt. With
  // the multi-step tool loop (up to bot.maxSteps iterations) the large
  // static prefix is re-sent as a cache hit each step instead of being
  // re-billed and re-processed in full. Anthropic skips caching silently
  // when the prefix is under the minimum cacheable size.
  const stream = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    temperature,
    messages: messages as Anthropic.MessageParam[],
    tools: tools as unknown as Anthropic.ToolUnion[],
    // One tool call per turn. This is what produces the chat → chart →
    // chat → chart rhythm: Claude emits all text first then all tool_use
    // blocks within a turn, so parallel tool use collapses a whole answer
    // into one text blob followed by a clump of charts. Capping the turn
    // at a single tool forces each visual into its own step, preceded by
    // its own narration — the way ChatGPT/Claude present analysis.
    tool_choice: { type: "auto", disable_parallel_tool_use: true },
    stream: true,
  });

  let text = "";
  const toolUses: CollectedToolUse[] = [];
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  // Word-level smoothing. Anthropic emits text_delta events in bursty
  // multi-token lumps; writing them straight to the wire reveals text in
  // visible chunks. We queue deltas and a pump drains them one word at a
  // time with a small delay, giving the steady cadence the AI SDK runtime
  // gets from smoothStream({ chunking: "word" }). We await the pump before
  // returning so all text is flushed ahead of this step's tool_call parts.
  let queue = "";
  let streamEnded = false;
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const pump = (async () => {
    for (;;) {
      // A complete word = leading whitespace + non-space run + one trailing
      // whitespace. We only release a word once its trailing boundary has
      // arrived, so we never split mid-token while the stream is live.
      const m = queue.match(/^\s*\S+\s/);
      if (m) {
        onText(m[0]);
        queue = queue.slice(m[0].length);
        await sleep(12);
        continue;
      }
      if (streamEnded) {
        if (queue) {
          onText(queue);
          queue = "";
        }
        return;
      }
      await sleep(4);
    }
  })();

  try {
    for await (const event of stream) {
      switch (event.type) {
        case "message_start":
          inputTokens = event.message.usage?.input_tokens ?? 0;
          // Output tokens come on message_delta; the count on message_start
          // is the prompt usage only.
          break;
        case "content_block_start":
          if (event.content_block.type === "tool_use") {
            toolUses.push({
              index: event.index,
              id: event.content_block.id,
              name: event.content_block.name,
              partialJson: "",
            });
          }
          break;
        case "content_block_delta":
          if (event.delta.type === "text_delta") {
            text += event.delta.text;
            queue += event.delta.text;
          } else if (event.delta.type === "input_json_delta") {
            const tu = toolUses.find((t) => t.index === event.index);
            if (tu) tu.partialJson += event.delta.partial_json;
          }
          break;
        case "message_delta":
          stopReason = event.delta.stop_reason ?? null;
          outputTokens = event.usage?.output_tokens ?? outputTokens;
          break;
        // message_stop / content_block_stop / ping: nothing to do
      }
    }
  } finally {
    // Always release the pump — on the error path too, otherwise its
    // `for (;;)` would spin on setTimeout forever (a leaked timer loop that
    // pins this invocation). The drain runs before the error propagates.
    streamEnded = true;
    await pump;
  }

  return { text, toolUses, stopReason, inputTokens, outputTokens };
}

function safeParse(json: string): unknown {
  if (!json || json.trim() === "") return {};
  try {
    return JSON.parse(json);
  } catch {
    // Tool input that arrived malformed — surface as empty object;
    // the tool's execute can choose to error.
    return {};
  }
}

export function streamViaAnthropicDirect(args: {
  bot: Chatbot;
  user: { id: string; role: UserRole; disabled: boolean };
  threadId: string;
  messages: UIMessage[];
  datasetId: string | null;
}): RuntimeStream {
  const { bot, user, threadId, messages, datasetId } = args;

  // Resolve tools once; the schemas + executor are shared across all
  // multi-step iterations.
  const toolBundle = buildAnthropicTools(bot, user, threadId, datasetId);
  const baseMessages = toAnthropicMessages(messages);

  // Closure that the createDataStreamResponse call invokes. We get a
  // writer (`stream`) we push DataStream parts into; the function
  // returns when the multi-step loop terminates.
  return {
    toDataStreamResponse: (init) =>
      createDataStreamResponse({
        headers: init.headers,
        onError: (err) =>
          init.getErrorMessage
            ? init.getErrorMessage(err)
            : err instanceof Error
              ? err.message
              : "Anthropic stream error",
        execute: async (writer) => {
          const client = getClient();
          const accumulatedToolCalls: Array<{
            toolCallId: string;
            toolName: string;
            args: unknown;
            result?: unknown;
          }> = [];
          // Ordered UI parts (text → tool → …) accumulated across steps, for
          // history interleaving (mirrors the AI SDK engine).
          const uiParts: unknown[] = [];
          // Every step's prose, joined for the persisted `content`. toAnthropic-
          // Messages rebuilds assistant history from `content` (not `parts`), and
          // the prompt deliberately spreads narration across steps — so persisting
          // only the last step's text would feed Claude just the closing sentence
          // of each prior turn after a refresh. Accumulate the whole turn instead.
          const textSegments: string[] = [];
          let totalIn = 0;
          let totalOut = 0;
          let finalStopReason: string | null = null;
          let stepIndex = 0;
          // Anthropic requires max_tokens; the AI SDK's nullable maxTokens
          // doesn't translate, so we provide a sane default when unset.
          const maxTokens = bot.maxTokens ?? 4096;
          const history: AnthropicMessage[] = [...baseMessages];
          // One id for the whole assistant message, stamped on every step.
          const messageId = crypto.randomUUID();

          try {
            while (stepIndex < bot.maxSteps) {
              // Emit a step boundary. This is what lets the client (useChat)
              // split assistant text into per-step parts and interleave them
              // with tool calls (text → chart → text → chart). Without the
              // start_step/finish_step markers, all text merges into a single
              // leading part and every chart stacks beneath it.
              writer.write(formatDataStreamPart("start_step", { messageId }));
              const step = await runStep(client, {
                model: bot.modelId,
                system: bot.systemPrompt,
                temperature: bot.temperature,
                maxTokens,
                messages: history,
                tools: toolBundle.schemas,
                onText: (delta) => {
                  writer.write(formatDataStreamPart("text", delta));
                },
              });

              totalIn += step.inputTokens;
              totalOut += step.outputTokens;
              finalStopReason = step.stopReason;
              if (step.text && step.text.trim()) {
                uiParts.push({ type: "text", text: step.text });
                textSegments.push(step.text.trim());
              }

              if (step.stopReason === "tool_use" && step.toolUses.length > 0) {
                // Build the assistant turn for history (text + tool_use blocks)
                const assistantBlocks: AnthropicContentBlock[] = [];
                if (step.text) assistantBlocks.push({ type: "text", text: step.text });
                const toolUseBlocks: AnthropicToolUseBlock[] = step.toolUses.map((tu) => {
                  const input = safeParse(tu.partialJson);
                  return {
                    type: "tool_use" as const,
                    id: tu.id,
                    name: tu.name,
                    input,
                  };
                });
                assistantBlocks.push(...toolUseBlocks);
                history.push({ role: "assistant", content: assistantBlocks });

                // Execute each tool, emit tool_call + tool_result parts to the
                // client, and append a single user message containing all
                // tool_result blocks (Anthropic disallows interleaving).
                const resultBlocks: AnthropicToolResultBlock[] = [];
                for (const block of toolUseBlocks) {
                  writer.write(
                    formatDataStreamPart("tool_call", {
                      toolCallId: block.id,
                      toolName: block.name,
                      args: block.input as Record<string, unknown>,
                    }),
                  );

                  let result: unknown;
                  let isError = false;
                  try {
                    result = await toolBundle.execute(block.name, block.input);
                  } catch (err) {
                    isError = true;
                    result = {
                      error: "tool_execution_failed",
                      message: err instanceof Error ? err.message : String(err),
                    };
                    captureError(err, {
                      route: "runtime.anthropic.tool",
                      slug: bot.slug,
                      botId: bot.id,
                      userId: user.id,
                      threadId,
                      tool: block.name,
                    });
                  }

                  accumulatedToolCalls.push({
                    toolCallId: block.id,
                    toolName: block.name,
                    args: block.input,
                    result,
                  });
                  uiParts.push({
                    type: "tool-invocation",
                    toolInvocation: {
                      state: "result",
                      toolCallId: block.id,
                      toolName: block.name,
                      args: block.input,
                      result,
                    },
                  });

                  writer.write(
                    formatDataStreamPart("tool_result", {
                      toolCallId: block.id,
                      result,
                    }),
                  );

                  resultBlocks.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content:
                      typeof result === "string" ? result : JSON.stringify(result ?? ""),
                    is_error: isError || undefined,
                  });
                }
                history.push({ role: "user", content: resultBlocks });

                writer.write(
                  formatDataStreamPart("finish_step", {
                    finishReason: "tool-calls",
                    isContinued: false,
                  }),
                );
                stepIndex++;
                continue;
              }

              // end_turn / max_tokens / stop_sequence — terminal.
              writer.write(
                formatDataStreamPart("finish_step", {
                  finishReason: "stop",
                  isContinued: false,
                }),
              );
              break;
            }

            const finishReason = toFinishReason(finalStopReason);
            const fullText = textSegments.join("\n\n");

            writer.write(
              formatDataStreamPart("finish_message", {
                finishReason: finishReason === "tool-calls" ? "tool-calls" : "stop",
                usage: {
                  promptTokens: totalIn,
                  completionTokens: totalOut,
                },
              }),
            );

            await recordTurnEnd({
              bot,
              user,
              threadId,
              text: fullText,
              toolCalls: accumulatedToolCalls,
              parts: uiParts,
              usage: { promptTokens: totalIn, completionTokens: totalOut },
              finishReason,
            });
          } catch (err) {
            captureError(err, {
              route: "runtime.anthropic",
              slug: bot.slug,
              botId: bot.id,
              userId: user.id,
              threadId,
              modelId: bot.modelId,
            });
            await recordTurnEnd({
              bot,
              user,
              threadId,
              text: textSegments.join("\n\n"),
              toolCalls: accumulatedToolCalls,
              parts: uiParts,
              usage: { promptTokens: totalIn, completionTokens: totalOut },
              finishReason: "error",
            });
            throw err;
          }
        },
      }),
  };
}
