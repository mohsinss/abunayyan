"use client";

import type { DistributionView, DistributionViewProps } from "./palette";
import { BarView } from "./bar-view";
import { DonutView } from "./donut-view";
import { ParetoView } from "./pareto-view";
import { RadialView } from "./radial-view";
import { TreemapView } from "./treemap-view";

// Dispatcher. Adding a new chart type = add a case + one new file under
// components/dashboard/distribution/; the outer orchestrator doesn't need
// to know anything beyond the DistributionView enum.
export function DistributionChart({
  view,
  ...props
}: DistributionViewProps & { view: DistributionView }) {
  switch (view) {
    case "bar":
      return <BarView {...props} />;
    case "pareto":
      return <ParetoView {...props} />;
    case "donut":
      return <DonutView {...props} />;
    case "radial":
      return <RadialView {...props} />;
    case "treemap":
      return <TreemapView {...props} />;
    default: {
      const _exhaustive: never = view;
      void _exhaustive;
      return null;
    }
  }
}
