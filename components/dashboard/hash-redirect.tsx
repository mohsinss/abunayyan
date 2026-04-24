"use client";

import { useEffect } from "react";

// /dashboard used to be a long-scroll with hash anchors
// (#composite-ranking, #quadrant-analysis, etc.) before phase 2 moved that
// content under /dashboard/sbu-performance-atlas. Bookmarks and external
// links from that era arrive here with a hash; silently forward them to
// the canonical SBU route so the anchor still works.
//
// Mounted once on the gallery page. No-op unless the current URL has a
// hash that looks like one of the old section anchors.
const KNOWN_ANCHORS = [
  "composite-ranking",
  "performance-table",
  "quadrant-analysis",
  "distribution",
  "cost-matrix",
  "departments",
  "strategic-readout",
];

export function HashRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash) return;
    if (!KNOWN_ANCHORS.includes(hash)) return;
    window.location.replace(`/dashboard/sbu-performance-atlas#${hash}`);
  }, []);
  return null;
}
