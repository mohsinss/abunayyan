import type { Tool } from "ai";
import type { UserRole } from "@/db/schema/users";
import type { ToolId } from "@/db/schema/chatbots";

export type ToolContext = {
  userId: string;
  role: UserRole;
  botId: string;
  threadId: string | null;
  // Set by per-card chatbot routes (phase 7 wires this in). Tools that scope
  // by card (searchDatasetDocs) require it; other tools ignore it.
  datasetId: string | null;
};

export type ToolBuilder = (_ctx: ToolContext) => Tool;

export type ToolDefinition = {
  id: ToolId;
  builder: ToolBuilder;
  description: string;
  requiresRole?: UserRole;
  costClass?: "free" | "cheap" | "expensive";
};
