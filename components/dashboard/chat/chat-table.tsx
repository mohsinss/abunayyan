"use client";

export interface TableArgs {
  title: string;
  caption?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  emphasis?: Array<{ rowIndex: number; tone: "positive" | "negative" | "neutral" }>;
}

// Subtle row tints aligned with the dashboard brand palette. Low-alpha
// fills of the semantic colours keep the table scannable on white
// without bleeding the gold/cream Atlas tints into navy contexts.
const TONE_BG: Record<NonNullable<TableArgs["emphasis"]>[0]["tone"], string> = {
  positive: "rgba(14, 138, 95, 0.08)",
  negative: "rgba(200, 70, 58, 0.08)",
  neutral: "rgba(11, 51, 120, 0.05)",
};

export function ChatTable({ args }: { args: TableArgs }) {
  const emphasisMap = new Map((args.emphasis ?? []).map((e) => [e.rowIndex, e.tone]));
  return (
    <figure className="my-3 overflow-hidden rounded-sm border border-atlas-line bg-atlas-bg-2">
      <figcaption className="border-b border-atlas-line px-3 py-2">
        <div className="font-serif text-[13px] font-medium text-atlas-ink">{args.title}</div>
        {args.caption && (
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-atlas-ink-3">
            {args.caption}
          </div>
        )}
      </figcaption>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr>
              {args.headers.map((h, i) => (
                <th
                  key={h + i}
                  className={`border-b border-atlas-line bg-atlas-bg-3 px-2.5 py-1.5 font-medium uppercase tracking-[0.8px] text-[9px] text-atlas-ink-3 ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {args.rows.map((row, rIdx) => {
              const tone = emphasisMap.get(rIdx);
              return (
                <tr
                  key={rIdx}
                  style={tone ? { backgroundColor: TONE_BG[tone] } : undefined}
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`border-b border-atlas-line px-2.5 py-1.5 tabular-nums ${
                        cIdx === 0
                          ? "text-left font-sans font-medium text-atlas-ink"
                          : "text-right text-atlas-ink-2"
                      }`}
                    >
                      {typeof cell === "number" ? cell.toLocaleString() : cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
