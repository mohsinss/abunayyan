import { type ReactNode } from "react";

interface SectionShellProps {
  id: string;
  num: string;
  title: ReactNode;
  description?: string;
  children: ReactNode;
}

export function SectionShell({ id, num, title, description, children }: SectionShellProps) {
  return (
    <section id={id} className="atlas-section-anchor mt-14">
      <header className="mb-4 flex items-baseline gap-5 border-b border-atlas-line pb-3">
        <span className="font-mono text-[11px] font-semibold tracking-[3px] text-atlas-gold">
          § {num}
        </span>
        <h2 className="font-serif text-[26px] font-medium tracking-tight text-atlas-ink md:text-[30px]">
          {title}
        </h2>
        {description && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[1.5px] text-atlas-ink-3">
            {description}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

export function Card({
  children,
  className = "",
  title,
  subtitle,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div
      className={`rounded-sm border border-atlas-line bg-atlas-bg-2 p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)] ${className}`}
    >
      {title && (
        <div className="mb-5 border-b border-atlas-line pb-3">
          <div className="font-serif text-[17px] font-medium tracking-tight text-atlas-ink">
            {title}
          </div>
          {subtitle && (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[1.2px] text-atlas-ink-3">
              {subtitle}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function FilterNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-r-sm border-l-[3px] border-atlas-gold bg-atlas-gold-soft px-4 py-3 font-mono text-[10px] leading-relaxed text-atlas-ink-2">
      {children}
    </div>
  );
}
