"use client";

export interface KpiArgs {
  title: string;
  subtitle?: string;
  items: Array<{
    label: string;
    value: string;
    note?: string;
    tone?: "positive" | "negative" | "neutral" | "warn";
  }>;
}

// Dashboard brand palette — keep semantic tones (good/bad) brand-aligned
// and the neutral default on the deep navy primary instead of the
// generic ink token (which renders gold/cream in the Atlas theme).
const toneColor: Record<NonNullable<KpiArgs["items"][0]["tone"]>, string> = {
  positive: "#0e8a5f",
  negative: "#c8463a",
  neutral: "#0b3378",
  warn: "#c98a2b",
};

export function ChatKpi({ args }: { args: KpiArgs }) {
  return (
    <figure className="my-3 overflow-hidden rounded-sm border border-atlas-line bg-atlas-bg-2">
      <figcaption className="border-b border-atlas-line px-3 py-2">
        <div className="font-serif text-[13px] font-medium text-atlas-ink">{args.title}</div>
        {args.subtitle && (
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-atlas-ink-3">
            {args.subtitle}
          </div>
        )}
      </figcaption>
      <dl className="grid grid-cols-2 gap-0 divide-x divide-atlas-line">
        {args.items.map((item, i) => {
          const col = toneColor[item.tone ?? "neutral"];
          return (
            <div
              key={item.label + i}
              className={`p-3 ${i >= 2 ? "border-t border-atlas-line" : ""}`}
            >
              <dt className="font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-atlas-ink-3">
                {item.label}
              </dt>
              <dd
                className="mt-1 font-serif text-[20px] font-medium leading-none tracking-tight"
                style={{ color: col }}
              >
                {item.value}
              </dd>
              {item.note && (
                <div className="mt-1.5 font-mono text-[9px] text-atlas-ink-3">{item.note}</div>
              )}
            </div>
          );
        })}
      </dl>
    </figure>
  );
}
