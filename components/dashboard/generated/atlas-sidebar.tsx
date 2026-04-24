"use client";

import { useScrollSpy } from "../use-scroll-spy";

export type AtlasSidebarItem = {
  id: string;
  num: string; // "01", "02", ...
  title: string;
  desc?: string;
};

// Generic editorial sidebar. Visually mirrors components/dashboard/sidebar-nav
// (SBU-bound) but is driven entirely by the items prop, so generated cards
// can populate it from CardConfig.views.
export function AtlasSidebar({
  items,
  title,
  eyebrow,
  meta,
}: {
  items: AtlasSidebarItem[];
  title: string;
  eyebrow?: string;
  meta?: string;
}) {
  const ids = items.map((s) => s.id);
  const active = useScrollSpy(ids);

  return (
    <aside className="atlas-scope hidden w-[260px] shrink-0 border-r border-atlas-line lg:block">
      <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col overflow-y-auto px-6 py-7">
        <div>
          {eyebrow ? (
            <div className="font-mono text-[9px] uppercase tracking-[2.5px] text-atlas-gold">
              {eyebrow}
            </div>
          ) : null}
          <div className="mt-1 font-serif text-[22px] font-medium leading-tight tracking-tight text-atlas-ink">
            {title}
          </div>
          {meta ? (
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[1.5px] text-atlas-ink-3">
              {meta}
            </div>
          ) : null}
        </div>

        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Card sections">
          {items.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
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
                  {s.desc ? (
                    <span className="block font-mono text-[9px] uppercase tracking-[1.2px] text-atlas-ink-3">
                      {s.desc}
                    </span>
                  ) : null}
                </span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
