"use client";

import { scrollToEntityRow, useSelectedEntity } from "./selected-entity-provider";

interface EntityChipProps {
  id: string;
  name: string;
  isJV?: boolean;
  variant?: "inline" | "pill";
  className?: string;
}

export function EntityChip({ id, name, isJV, variant = "inline", className = "" }: EntityChipProps) {
  const { isActive, selectEntity, hoverEntity } = useSelectedEntity();
  const active = isActive(id);

  const baseClasses =
    variant === "pill"
      ? "inline-flex items-center gap-1.5 rounded-sm border border-atlas-line bg-atlas-bg-2 px-2 py-0.5 font-sans text-[12px] font-medium hover:border-atlas-gold"
      : "inline-flex items-center gap-1.5 font-sans font-medium hover:text-atlas-gold";

  return (
    <button
      type="button"
      className={`${baseClasses} transition-colors ${active ? "text-atlas-gold" : "text-atlas-ink"} ${className}`}
      onClick={() => {
        selectEntity(id);
        scrollToEntityRow(id);
      }}
      onMouseEnter={() => hoverEntity(id)}
      onMouseLeave={() => hoverEntity(null)}
    >
      <span>{name}</span>
      {isJV && (
        <span className="rounded-sm bg-atlas-gold-soft px-1.5 py-[1px] font-mono text-[8px] tracking-[1px] text-atlas-gold">
          JV
        </span>
      )}
    </button>
  );
}
