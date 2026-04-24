"use client";

import { type ReactNode } from "react";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (_v: T) => void;
  options: SegmentedOption<T>[];
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-atlas-ink-3">
          {label}
        </span>
      )}
      <div className="inline-flex overflow-hidden rounded-sm border border-atlas-line bg-atlas-bg-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[1.2px] transition-colors ${
                active
                  ? "bg-atlas-ink text-atlas-bg-2"
                  : "text-atlas-ink-2 hover:bg-atlas-bg-3 hover:text-atlas-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FilterChips<T extends string>({
  values,
  onToggle,
  options,
  label,
}: {
  values: T[];
  onToggle: (_v: T) => void;
  options: Array<{ value: T; label: string; dot?: string }>;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="mr-1 font-mono text-[9px] uppercase tracking-[1.5px] text-atlas-ink-3">
          {label}
        </span>
      )}
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.2px] transition-colors ${
              active
                ? "border-atlas-ink bg-atlas-ink text-atlas-bg-2"
                : "border-atlas-line bg-atlas-bg-2 text-atlas-ink-2 hover:border-atlas-gold"
            }`}
          >
            {o.dot && (
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: o.dot }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-atlas-line pb-4">
      {children}
    </div>
  );
}
