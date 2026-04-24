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
};

export function getBuiltinByKey(key: string | null | undefined): BuiltinCard | null {
  if (!key) return null;
  return BUILTIN_CARDS[key] ?? null;
}
