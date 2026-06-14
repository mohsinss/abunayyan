import { requireUser } from "@/lib/auth/session";
import { CardTile, type CardAccent } from "@/components/dashboard/card-tile";
import { BUILTIN_CARDS } from "@/lib/datasets/builtins";

export const metadata = { title: "Dashboards" };

// Curated hub. Lists the hand-built dashboards registered in BUILTIN_CARDS.
// Add a new dashboard by dropping a page folder under app/(app)/dashboard/<route>/
// and registering it in lib/datasets/builtins.ts — it shows up here automatically.
const ACCENTS: Record<string, { accent: CardAccent; badge?: string }> = {
  "working-capital-data": { accent: "navy", badge: "Live · DB" },
  "wc-intelligence": { accent: "navy", badge: "Excel-fed · AI" },
};

export default async function DashboardHubPage() {
  await requireUser();

  const tiles = Object.values(BUILTIN_CARDS).map((card) => {
    const a = ACCENTS[card.route] ?? { accent: "default" as CardAccent };
    return {
      key: card.key,
      title: card.title,
      description: card.description,
      href: `/dashboard/${card.route}`,
      accent: a.accent,
      badge: a.badge,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboards</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a dashboard to explore its charts and chatbot.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <CardTile
            key={t.key}
            title={t.title}
            description={t.description}
            href={t.href}
            accent={t.accent}
            badge={t.badge}
          />
        ))}
      </div>
    </div>
  );
}
