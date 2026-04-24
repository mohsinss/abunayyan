"use client";

import { Component, type ReactNode } from "react";

type State = { error: Error | null };

// Per-view client-side ErrorBoundary. Keeps one broken chart from blowing up
// the rest of the card. Pairs with renderer/aggregate.ts: resolveViewColumns
// catches *config* drift at render time; this catches *runtime* drift
// (Recharts throwing on malformed data, a tool call returning NaN that
// Recharts rejects, etc.). React 19 has no built-in error boundary so we
// keep this minimal class component.
export class ViewBoundary extends Component<{ children: ReactNode; title: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface in the browser console; Sentry catches via its React
    // integration if wired, so we don't double-capture here.
    console.error(`ViewBoundary caught error in "${this.props.title}":`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <h3 className="text-base font-semibold">{this.props.title}</h3>
          <p className="mt-2 text-sm text-destructive">
            View crashed while rendering: {this.state.error.message}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Other views on this card are unaffected.
          </p>
        </section>
      );
    }
    return this.props.children;
  }
}
