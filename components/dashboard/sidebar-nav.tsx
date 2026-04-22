"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { entities } from "@/lib/dashboard/data";
import { sectionAnchors } from "@/lib/dashboard/tokens";
import { useScrollSpy } from "./use-scroll-spy";
import { scrollToEntityRow, scrollToSection, useSelectedEntity } from "./selected-entity-provider";

const sectionIds = sectionAnchors.map((s) => s.id);

export function SidebarNav() {
  const active = useScrollSpy(sectionIds);
  const [query, setQuery] = useState("");
  const { selectEntity } = useSelectedEntity();

  const matches = query.trim()
    ? entities.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  return (
    <aside className="atlas-scope hidden w-[260px] shrink-0 border-r border-atlas-line lg:block">
      <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col overflow-y-auto px-6 py-7">
        <button
          type="button"
          className="text-left"
          onClick={() => scrollToSection(sectionAnchors[0].id)}
        >
          <div className="font-mono text-[9px] uppercase tracking-[2.5px] text-atlas-gold">
            AHC · AI Transformation
          </div>
          <div className="mt-1 font-serif text-[22px] font-medium leading-tight tracking-tight text-atlas-ink">
            SBU Performance<br />
            <em className="italic text-atlas-gold">Atlas</em>
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[1.5px] text-atlas-ink-3">
            FY2026 · v1.1
          </div>
        </button>

        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Dashboard sections">
          {sectionAnchors.map((s) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className={`group flex items-start gap-3 border-l-2 px-3 py-2 text-left transition-colors ${
                  isActive
                    ? "border-atlas-gold bg-atlas-gold-soft/60"
                    : "border-transparent hover:border-atlas-line-2 hover:bg-atlas-bg-3"
                }`}
              >
                <span
                  className={`font-mono text-[10px] tracking-[1.8px] ${
                    isActive ? "text-atlas-gold" : "text-atlas-ink-3"
                  }`}
                >
                  § {s.num}
                </span>
                <span className="flex-1">
                  <span
                    className={`block font-sans text-[13px] font-medium ${
                      isActive ? "text-atlas-ink" : "text-atlas-ink-2"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="block font-mono text-[9px] uppercase tracking-[1.2px] text-atlas-ink-3">
                    {s.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-atlas-line pt-6">
          <label className="mb-2 block font-mono text-[9px] uppercase tracking-[1.8px] text-atlas-ink-3">
            Entity search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-atlas-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find entity…"
              className="w-full rounded-sm border border-atlas-line bg-atlas-bg-2 py-1.5 pl-8 pr-2 font-mono text-[11px] text-atlas-ink outline-none placeholder:text-atlas-ink-3 focus:border-atlas-gold"
            />
          </div>
          {matches.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5">
              {matches.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-left font-sans text-[12px] text-atlas-ink hover:bg-atlas-gold-soft"
                    onClick={() => {
                      selectEntity(e.id);
                      scrollToEntityRow(e.id);
                      setQuery("");
                    }}
                  >
                    <span>{e.name}</span>
                    {e.isJV && (
                      <span className="rounded-sm bg-atlas-gold-soft px-1.5 font-mono text-[8px] tracking-[1px] text-atlas-gold">
                        JV
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto pt-8 font-mono text-[9px] uppercase tracking-[1.2px] text-atlas-ink-3">
          <div>Confidential</div>
          <div className="mt-1 normal-case tracking-normal text-atlas-ink-2">
            Distribution: CFO · Strategy · EPMO
          </div>
        </div>
      </div>
    </aside>
  );
}
