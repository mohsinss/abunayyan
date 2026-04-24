import { hasRole } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";
import { CardTile, CreateCardTile } from "@/components/dashboard/card-tile";
import { getBuiltinByKey } from "@/lib/datasets/builtins";
import { listDatasets } from "@/lib/db/queries/datasets";

export const metadata = { title: "Datasets · Dashboard" };

export default async function DashboardGalleryPage() {
  const user = await requireUser();
  const isAdmin = hasRole(user.role, "admin");
  const rows = await listDatasets();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Datasets</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a card to see its charts and chatbot.
          {isAdmin ? " Admins can create new cards from uploaded files." : ""}
        </p>
      </header>

      {rows.length === 0 && !isAdmin ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((ds) => {
            const builtin =
              ds.kind === "builtin" ? getBuiltinByKey(ds.config?.builtinKey) : null;
            const href = builtin ? `/dashboard/${builtin.route}` : `/dashboard/${ds.slug}`;
            const meta =
              ds.kind === "builtin"
                ? "Builtin"
                : new Date(ds.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
            return (
              <CardTile
                key={ds.id}
                title={ds.title}
                description={ds.description}
                href={href}
                meta={meta}
              />
            );
          })}
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
