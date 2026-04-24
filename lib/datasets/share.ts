import "server-only";
import { randomBytes } from "node:crypto";

// 32 random bytes → 43-char URL-safe base64. Long enough that enumeration is
// infeasible; short enough to paste into a link.
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export const PUBLIC_TOOLS = [
  "searchDatasetDocs",
  "queryDatasetRows",
  "renderChart",
  "renderTable",
  "renderKpiList",
] as const;
