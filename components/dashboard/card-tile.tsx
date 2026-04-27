import Link from "next/link";
import { ArrowUpRight, Plus, Radio, Sparkles } from "lucide-react";

// Visual accent on the gallery tiles. Default tiles render plain.
// "navy" tiles get the brand gradient stripe + a glowing badge — used
// for the DB-backed Working Capital brief so it stands out from the
// static FY-2025 card and reads as the live, editable surface.
export type CardAccent = "default" | "navy" | "atlas";

type CardTileProps = {
  title: string;
  description: string | null;
  href: string;
  meta?: string | null;
  accent?: CardAccent;
  badge?: string | null;
};

const NAVY_1 = "#0b3378";
const NAVY_2 = "#2964a9";
const NAVY_3 = "#418cc0";

export function CardTile({
  title,
  description,
  href,
  meta,
  accent = "default",
  badge,
}: CardTileProps) {
  if (accent === "navy") return <NavyTile {...{ title, description, href, meta, badge }} />;
  if (accent === "atlas") return <AtlasTile {...{ title, description, href, meta, badge }} />;
  return <DefaultTile {...{ title, description, href, meta, badge }} />;
}

function DefaultTile({
  title,
  description,
  href,
  meta,
  badge,
}: Omit<CardTileProps, "accent">) {
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
      <div className="mt-auto flex items-center gap-2 pt-4">
        {badge ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        ) : null}
        {meta ? (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{meta}</p>
        ) : null}
      </div>
    </Link>
  );
}

// Gradient navy tile — matches the /working-capital-data dashboard's
// brand-1/2/3 palette so the gallery tile feels like a preview of the
// page it links to. Uses a coloured left-edge stripe (mirroring the
// KPI cards on the dashboard), a soft top-right glow, and a "LIVE"
// pill in the action area.
function NavyTile({
  title,
  description,
  href,
  meta,
  badge,
}: Omit<CardTileProps, "accent">) {
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-lg p-6 transition hover:shadow-lg"
      style={{
        background: "linear-gradient(180deg, #f6f9ff 0%, #ffffff 70%)",
        border: "1px solid #d5e2f3",
        boxShadow: "0 1px 2px rgba(11,51,120,0.04), 0 8px 24px rgba(11,51,120,0.06)",
      }}
    >
      {/* Left-edge brand stripe (same idiom as the dashboard's KPI cards). */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: `linear-gradient(180deg, ${NAVY_1}, ${NAVY_3})` }}
      />
      {/* Soft top-right glow that intensifies on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-60 transition-opacity group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle, rgba(65,140,192,0.18), transparent 70%)`,
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-white"
            style={{
              background: `linear-gradient(135deg, ${NAVY_1}, ${NAVY_3})`,
              boxShadow: "0 4px 12px rgba(11,51,120,0.22)",
            }}
          >
            <Sparkles className="size-3.5" />
          </span>
          <h3 className="text-lg font-semibold leading-tight" style={{ color: NAVY_1 }}>
            {title}
          </h3>
        </div>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          style={{ color: NAVY_2 }}
        />
      </div>
      {description ? (
        <p
          className="relative mt-3 line-clamp-4 text-sm leading-relaxed"
          style={{ color: "#4a5568" }}
        >
          {description}
        </p>
      ) : null}
      <div className="relative mt-auto flex items-center gap-2 pt-5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
          style={{
            background: `linear-gradient(135deg, ${NAVY_1}, ${NAVY_2})`,
            boxShadow: "0 2px 6px rgba(11,51,120,0.28)",
          }}
        >
          <Radio className="size-3 animate-pulse" />
          {badge ?? "Live"}
        </span>
        {meta ? (
          <p
            className="text-[10.5px] font-medium uppercase tracking-[0.16em]"
            style={{ color: NAVY_2 }}
          >
            {meta}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

// Subtle warm accent for the SBU Atlas tile — matches the cream/gold
// editorial palette used by /sbu-performance-atlas.
function AtlasTile({
  title,
  description,
  href,
  meta,
  badge,
}: Omit<CardTileProps, "accent">) {
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-lg p-6 transition hover:shadow-md"
      style={{
        background: "linear-gradient(180deg, #fdfaf2 0%, #ffffff 70%)",
        border: "1px solid #efe5cc",
        boxShadow: "0 1px 2px rgba(139,111,46,0.05)",
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: "linear-gradient(180deg, #8b6f2e, #c9a44b)" }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-tight" style={{ color: "#3a2f15" }}>
          {title}
        </h3>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          style={{ color: "#8b6f2e" }}
        />
      </div>
      {description ? (
        <p
          className="relative mt-2 line-clamp-4 text-sm leading-relaxed"
          style={{ color: "#5a4d2f" }}
        >
          {description}
        </p>
      ) : null}
      <div className="relative mt-auto flex items-center gap-2 pt-4">
        {badge ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              background: "rgba(139,111,46,0.10)",
              color: "#8b6f2e",
              border: "1px solid rgba(139,111,46,0.22)",
            }}
          >
            {badge}
          </span>
        ) : null}
        {meta ? (
          <p
            className="text-[10.5px] font-medium uppercase tracking-[0.16em]"
            style={{ color: "#8b6f2e" }}
          >
            {meta}
          </p>
        ) : null}
      </div>
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
