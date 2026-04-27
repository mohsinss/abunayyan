// Registry of builtin dataset cards. Each entry points at a hand-coded page
// under app/(app)/dashboard/<route>/ and a seeded chatbot by slug. Adding a
// new builtin is: drop a page folder in, add an entry here, re-seed.
// See docs/datasets-cards-plan.md §9.

export type BuiltinCard = {
  key: string;
  title: string;
  description: string;
  // Slug path segment under /dashboard/ (also used as the dataset row's slug).
  route: string;
  // Slug of the chatbot row seeded via lib/chatbots/seed-defaults.ts.
  chatbotSlug: string;
};

export const BUILTIN_CARDS: Record<string, BuiltinCard> = {
  "sbu-atlas": {
    key: "sbu-atlas",
    title: "SBU Performance Atlas — FY2026",
    description:
      "14 SBUs, 15 HQ departments, and the SLA allocation matrix. Composite ranking, quadrant analysis, cost matrix, and strategic readout across seven analytical sections.",
    route: "sbu-performance-atlas",
    chatbotSlug: "atlas-analyst",
  },
  "working-capital-ccc": {
    key: "working-capital-ccc",
    title: "Working Capital & CCC — Interactive Brief",
    description:
      "FY-2023 → FY-2025 working capital and cash conversion cycle model. Drag sliders for Inventory, AR, Contract Assets, AP and DIO/DSO/DPO across 10 SBUs to see live group impact and identified cash release.",
    route: "working-capital-ccc",
    chatbotSlug: "atlas-analyst",
  },
  "working-capital-data": {
    key: "working-capital-data",
    title: "Working Capital & CCC — Live Brief (DB-backed)",
    description:
      "Same interactive working-capital model, but every figure is sourced from Postgres (wc_groups / wc_sbus / wc_narrative) so admins can edit numbers in /admin/working-capital and the chatbot's vector knowledge base re-syncs on the next retrain. The static brief stays available alongside.",
    route: "working-capital-data",
    // Empty slug → seed leaves chatbot_id NULL on this dataset row, so
    // the existing dataset-by-chatbot lookup keeps resolving to the
    // working-capital-ccc dataset (the one with embedded chunks).
    chatbotSlug: "",
  },
};

export function getBuiltinByKey(key: string | null | undefined): BuiltinCard | null {
  if (!key) return null;
  return BUILTIN_CARDS[key] ?? null;
}
