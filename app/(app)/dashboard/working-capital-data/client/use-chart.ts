"use client";
import { Chart, registerables, type ChartConfiguration } from "chart.js";
import { useEffect, useRef } from "react";

let registered = false;
function ensureRegistered() {
  if (!registered) {
    Chart.register(...registerables);
    registered = true;
  }
}

// Thin React wrapper around Chart.js. Creates the chart on mount with
// the initial config; on every config change, applies new data + options
// via chart.update("none") to avoid React-reconciling 70+ data points
// per slider tick. The destroy on unmount frees the canvas WebGL/2D
// context — Chart.js leaks otherwise.
export function useChart<TConfig extends ChartConfiguration>(config: TConfig) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    ensureRegistered();
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // We deliberately mount-with-initial-config and update via the next
    // effect; recreating on every config change kills perf during drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = chartRef.current;
    if (!c) return;
    c.data = config.data;
    c.options = config.options ?? {};
    c.update("none");
  }, [config]);

  return canvasRef;
}
