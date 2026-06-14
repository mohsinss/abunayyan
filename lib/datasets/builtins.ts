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
  "working-capital-data": {
    key: "working-capital-data",
    title: "Working Capital & CCC — Live Brief (DB-backed)",
    description:
      "Interactive working-capital model where every figure is sourced from Postgres (wc_groups / wc_sbus / wc_narrative) so admins can edit numbers in /admin/working-capital and the chatbot's vector knowledge base re-syncs on the next retrain.",
    route: "working-capital-data",
    // Empty slug → seed leaves chatbot_id NULL on this dataset row, so
    // the existing dataset-by-chatbot lookup keeps resolving to the
    // working-capital-ccc dataset (the one with embedded chunks).
    chatbotSlug: "",
  },
  "wc-intelligence": {
    key: "wc-intelligence",
    title: "WC Intelligence — Board Brief",
    description:
      "Excel-fed working capital intelligence across 12 SBUs: 36 months of P&L, balance-sheet, AR/AP aging, inventory, cash flow and drivers parsed from the data-collection workbook into a versioned metric store. Deterministic analyst chatbot answers with exact figures, comparisons and trends — zero LLM arithmetic.",
    route: "wc-intelligence",
    chatbotSlug: "wc-intelligence-analyst",
  },
};

export function getBuiltinByKey(key: string | null | undefined): BuiltinCard | null {
  if (!key) return null;
  return BUILTIN_CARDS[key] ?? null;
}
