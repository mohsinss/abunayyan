import "server-only";
import type { Tool } from "ai";
import type { Chatbot, ToolId } from "@/db/schema/chatbots";
import { USER_ROLES, type UserRole } from "@/db/schema/users";
import { renderChart } from "./render-chart";
import { renderTable } from "./render-table";
import { renderKpiList } from "./render-kpi";
import { searchDocs } from "./search-docs";
import { searchDatasetDocs } from "./search-dataset-docs";
import { queryDatasetRows } from "./query-dataset-rows";
import { atlasSnapshot } from "./atlas-snapshot";
import type { ToolContext, ToolDefinition } from "./types";

const ALL_TOOLS: Record<ToolId, ToolDefinition> = {
  renderChart,
  renderTable,
  renderKpiList,
  searchDocs,
  searchDatasetDocs,
  queryDatasetRows,
  atlasSnapshot,
};

const RANK: Record<UserRole, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function getToolsForBot(
  bot: Pick<Chatbot, "id" | "tools">,
  user: { id: string; role: UserRole; disabled: boolean },
  threadId: string | null = null,
  datasetId: string | null = null,
): Record<string, Tool> {
  const ctx: ToolContext = {
    userId: user.id,
    role: user.role,
    botId: bot.id,
    threadId,
    datasetId,
  };
  const out: Record<string, Tool> = {};
  for (const id of bot.tools) {
    const def = ALL_TOOLS[id];
    if (!def) continue;
    if (def.requiresRole && RANK[user.role] < RANK[def.requiresRole]) continue;
    out[def.id] = def.builder(ctx);
  }
  return out;
}

export function listAllTools(): ToolDefinition[] {
  return Object.values(ALL_TOOLS);
}

export { USER_ROLES };
