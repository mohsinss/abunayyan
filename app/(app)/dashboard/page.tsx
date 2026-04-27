import { hasRole } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { CardTile, CreateCardTile, type CardAccent } from "@/components/dashboard/card-tile";
import { HashRedirect } from "@/components/dashboard/hash-redirect";
import { BUILTIN_CARDS, getBuiltinByKey } from "@/lib/datasets/builtins";
import { listDatasets } from "@/lib/db/queries/datasets";

export const metadata = { title: "Datasets · Dashboard" };

type Tile = {
  id: string;
  title: string;
  description: string | null;
  href: string;
  meta: string;
  accent?: CardAccent;
  badge?: string;
};

// Per-route visual treatment. Routes not listed fall back to default.
function accentForRoute(route: string): { accent: CardAccent; badge?: string } {
  if (route === "working-capital-data") return { accent: "navy", badge: "Live · DB" };
  if (route === "sbu-performance-atlas") return { accent: "atlas", badge: "FY-2026" };
  if (route === "working-capital-ccc") return { accent: "default", badge: "Static" };
  return { accent: "default" };
}

export default async function DashboardGalleryPage() {
  const user = await requireUser();
  const isAdmin = hasRole(user.role, "admin");
  const rows = await listDatasets();

  const tiles: Tile[] = rows.map((ds) => {
    const builtin = ds.kind === "builtin" ? getBuiltinByKey(ds.config?.builtinKey) : null;
    const route = builtin ? builtin.route : ds.slug;
    const a = accentForRoute(route);
    return {
      id: ds.id,
      title: ds.title,
      description: ds.description,
      href: `/dashboard/${route}`,
      meta:
        ds.kind === "builtin"
          ? "Builtin"
          : new Date(ds.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
      accent: a.accent,
      badge: a.badge,
    };
  });

  // Surface any registered builtin that hasn't been seeded into the DB yet
  // (Vercel build runs db:migrate but not db:seed). Keeps the gallery in sync
  // with the BUILTIN_CARDS registry without requiring a manual seed.
  const seededRoutes = new Set(
    rows
      .filter((ds) => ds.kind === "builtin")
      .map((ds) => getBuiltinByKey(ds.config?.builtinKey)?.route ?? ds.slug),
  );
  for (const card of Object.values(BUILTIN_CARDS)) {
    if (seededRoutes.has(card.route)) continue;
    const a = accentForRoute(card.route);
    tiles.push({
      id: `builtin-${card.key}`,
      title: card.title,
      description: card.description,
      href: `/dashboard/${card.route}`,
      meta: "Builtin",
      accent: a.accent,
      badge: a.badge,
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <HashRedirect />
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Datasets</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a card to see its charts and chatbot.
          {isAdmin ? " Admins can create new cards from uploaded files." : ""}
        </p>
      </header>

      {tiles.length === 0 && !isAdmin ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <CardTile
              key={t.id}
              title={t.title}
              description={t.description}
              href={t.href}
              meta={t.meta}
              accent={t.accent}
              badge={t.badge}
            />
          ))}
          {isAdmin ? <CreateCardTile href="/dashboard/new" /> : null}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">
        No datasets yet. An admin can create one to get started.
      </p>
    </div>
  );
}
