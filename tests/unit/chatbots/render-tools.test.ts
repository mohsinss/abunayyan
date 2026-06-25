import { describe, expect, it } from "vitest";
import type { ToolId } from "@/db/schema/chatbots";
import { buildAnthropicTools } from "@/lib/chatbots/tools/adapters/anthropic";

// Regression cover for the render-tool hardening: the model occasionally
// overshoots a list cap (a full snapshot crammed into one KPI card) or emits
// an off-vocab enum. Before, that threw "Invalid arguments for tool …" and —
// on the AI SDK path — killed the whole turn. Now the schemas clamp/catch, and
// the direct-engine executor (buildAnthropicTools.execute) validates so the
// cleaning actually runs before a render component sees the data, while a
// genuinely broken arg degrades to a recoverable tool_result error.

const bot = {
  id: "test-bot",
  tools: ["renderKpiList", "renderChart", "renderTable", "renderWaterfall"] as ToolId[],
};
const user = { id: "u1", role: "owner" as const, disabled: false };
const bundle = buildAnthropicTools(bot, user, "t1", null);

type KpiResult = { items: Array<{ value: unknown; tone?: string }> };
type ChartResult = { type: string; data: Array<{ tone?: string }> };

describe("render-tool tolerance via the direct executor", () => {
  it("clamps an over-cap KPI list to 16 instead of throwing", async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ label: `KPI ${i}`, value: i }));
    const res = (await bundle.execute("renderKpiList", { title: "Snapshot", items })) as KpiResult;
    expect(res.items).toHaveLength(16);
  });

  it("coerces a numeric KPI value to a string", async () => {
    const res = (await bundle.execute("renderKpiList", {
      title: "Snapshot",
      items: [{ label: "NWC", value: 344 }],
    })) as KpiResult;
    expect(res.items[0].value).toBe("344");
  });

  it("accepts a legitimate 12-item snapshot (the original repro) unchanged", async () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ label: `KPI ${i}`, value: `${i}` }));
    const res = (await bundle.execute("renderKpiList", { title: "Wetico", items })) as KpiResult;
    expect(res.items).toHaveLength(12);
  });

  it("falls back to a safe default for an off-vocab enum rather than rejecting", async () => {
    const res = (await bundle.execute("renderChart", {
      type: "donut", // not a real chart type
      title: "T",
      data: [{ label: "a", value: 1, tone: "explode" }],
    })) as ChartResult;
    expect(res.type).toBe("bar");
    expect(res.data[0].tone).toBe("neutral");
  });

  it("clamps an over-cap chart series to 60 points", async () => {
    const data = Array.from({ length: 75 }, (_, i) => ({ label: `m${i}`, value: i }));
    const res = (await bundle.execute("renderChart", { type: "line", title: "T", data })) as {
      data: unknown[];
    };
    expect(res.data).toHaveLength(60);
  });

  it("returns a recoverable error (not a throw) for genuinely invalid args", async () => {
    // headers below min(2) and zero rows — unrepairable, must degrade gracefully.
    const res = (await bundle.execute("renderTable", {
      title: "T",
      headers: ["only-one"],
      rows: [],
    })) as { error?: string };
    expect(res.error).toBe("invalid_tool_arguments");
  });

  it("never rejects an off-vocab waterfall step tone", async () => {
    const res = (await bundle.execute("renderWaterfall", {
      title: "Bridge",
      start: { label: "Open", value: 100 },
      steps: [{ label: "AR", delta: -10, tone: "huge" }],
    })) as { steps: Array<{ tone?: string }> };
    expect(res.steps[0].tone).toBe("neutral");
  });
});
