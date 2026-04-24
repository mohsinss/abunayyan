// Generic editorial header for generated cards. Shape mirrors the SBU
// DashboardHeader: eyebrow → big serif title → italic byline → meta badge.
// All text content comes in as props so a "Q1 Supplier Spend" card and the
// SBU Atlas can share visual rhythm without sharing copy.
export function AtlasHeader({
  title,
  description,
  eyebrow,
  meta,
}: {
  title: string;
  description: string | null;
  eyebrow?: string;
  meta?: string;
}) {
  return (
    <header className="flex flex-col items-start gap-5 border-b border-atlas-ink pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <div className="font-mono text-[10px] font-medium uppercase tracking-[3px] text-atlas-gold">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-2 font-serif text-[42px] font-medium leading-none tracking-tight text-atlas-ink md:text-[54px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-[720px] font-serif text-[15px] italic leading-snug text-atlas-ink-2 md:text-[17px]">
            {description}
          </p>
        ) : null}
      </div>
      {meta ? (
        <div className="font-mono text-[10px] leading-[1.8] tracking-[0.5px] text-atlas-ink-3 md:text-right">
          <span className="inline-block border border-atlas-line-2 bg-atlas-bg-2 px-2 py-[2px] text-[9px] uppercase tracking-[1px] text-atlas-gold">
            {meta}
          </span>
        </div>
      ) : null}
    </header>
  );
}
