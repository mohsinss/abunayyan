"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface SelectedEntityState {
  selectedId: string | null;
  hoveredId: string | null;
  selectEntity: (_id: string | null) => void;
  hoverEntity: (_id: string | null) => void;
  isActive: (_id: string) => boolean;
}

const Ctx = createContext<SelectedEntityState | null>(null);

export function SelectedEntityProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const selectEntity = useCallback((id: string | null) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const hoverEntity = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  const isActive = useCallback(
    (id: string) => selectedId === id || hoveredId === id,
    [selectedId, hoveredId],
  );

  const value = useMemo(
    () => ({ selectedId, hoveredId, selectEntity, hoverEntity, isActive }),
    [selectedId, hoveredId, selectEntity, hoverEntity, isActive],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelectedEntity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSelectedEntity must be used within SelectedEntityProvider");
  return ctx;
}

export function scrollToEntityRow(entityId: string) {
  const el = document.getElementById(`entity-row-${entityId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("animate-atlas-flash");
  // Retrigger CSS animation.
  void el.offsetWidth;
  el.classList.add("animate-atlas-flash");
}

export function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  if (typeof history !== "undefined") {
    history.replaceState(null, "", `#${sectionId}`);
  }
}
