import { auth } from "@/lib/auth";
import { streamText, convertToCoreMessages, tool, type UIMessage } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/client";
import { buildAtlasSystemPrompt } from "@/lib/dashboard/chat-context";
import { ratelimit } from "@/lib/ratelimit";
import { captureError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const chartTool = tool({
  description:
    "Render a chart inline in the chat. Use 'bar' for rankings, 'horizontal-bar' for side-by-side comparisons of many entities, 'pie' for share-of-whole distributions, 'scatter' for relationships between two numeric metrics. Data points require a label and numeric value (x/y for scatter).",
  parameters: z.object({
    type: z.enum(["bar", "horizontal-bar", "pie", "scatter"]),
    title: z.string(),
    description: z.string().optional(),
    unit: z.string().optional().describe("e.g. 'SAR', '%', 'employees'"),
    xAxisLabel: z.string().optional(),
    yAxisLabel: z.string().optional(),
    data: z
      .array(
        z.object({
          label: z.string(),
          value: z.number().optional(),
          x: z.number().optional(),
          y: z.number().optional(),
          tone: z
            .enum(["positive", "neutral", "warn", "negative"])
            .optional()
            .describe("Color hint; omit to use automatic rank coloring"),
        }),
      )
      .min(1)
      .max(30),
  }),
  execute: async (args) => args,
});

const tableTool = tool({
  description:
    "Render a table inline in the chat. Best for side-by-side metric comparisons across a small number of entities.",
  parameters: z.object({
    title: z.string(),
    caption: z.string().optional(),
    headers: z.array(z.string()).min(2).max(8),
    rows: z.array(z.array(z.union([z.string(), z.number()]))).min(1).max(20),
    emphasis: z
      .array(
        z.object({
          rowIndex: z.number().int().nonnegative(),
          tone: z.enum(["positive", "negative", "neutral"]),
        }),
      )
      .optional(),
  }),
  execute: async (args) => args,
});

const kpiTool = tool({
  description:
    "Render a compact KPI list inline — for single-entity financial snapshots ('What's Wetico's financial position?').",
  parameters: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    items: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          note: z.string().optional(),
          tone: z.enum(["positive", "negative", "neutral"]).optional(),
        }),
      )
      .min(1)
      .max(10),
  }),
  execute: async (args) => args,
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { success } = await ratelimit.ai.limit(userId);
  if (!success) return new Response("Rate limit exceeded", { status: 429 });

  try {
    const { messages } = (await req.json()) as { messages: UIMessage[] };

    const result = streamText({
      model: models.default,
      system: buildAtlasSystemPrompt(),
      messages: convertToCoreMessages(messages),
      tools: {
        renderChart: chartTool,
        renderTable: tableTool,
        renderKpiList: kpiTool,
      },
      maxSteps: 3,
      temperature: 0.3,
    });

    return result.toDataStreamResponse();
  } catch (err) {
    captureError(err, { route: "ai/atlas-chat" });
    return new Response("Atlas chat failed", { status: 500 });
  }
}
