// Per-user pref keys for the Working Capital data dashboard. Lives in
// its own module so it can be imported from both the server page and
// any "use server" actions file (which is restricted to exporting
// async functions only — see invalid-use-server-value docs).
export const WC_PREF_KEYS = {
  showNwcTrendlines: "wcShowNwcTrendlines",
} as const;
