import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

type CardTileProps = {
  title: string;
  description: string | null;
  href: string;
  meta?: string | null;
};

export function CardTile({ title, description, href, meta }: CardTileProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col rounded-lg border border-border bg-card p-6 transition hover:border-foreground/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-tight text-foreground">{title}</h3>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
      </div>
      {description ? (
        <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {meta ? (
        <p className="mt-auto pt-4 text-xs uppercase tracking-wide text-muted-foreground">
          {meta}
        </p>
      ) : null}
    </Link>
  );
}

type CreateTileProps = { href: string };

export function CreateCardTile({ href }: CreateTileProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-6 text-center transition hover:border-foreground/40 hover:bg-card"
    >
      <div>
        <Plus className="mx-auto h-6 w-6 text-muted-foreground group-hover:text-foreground" />
        <div className="mt-2 text-sm font-medium text-foreground">Create new dataset</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Upload files and let the AI propose a card
        </div>
      </div>
    </Link>
  );
}
