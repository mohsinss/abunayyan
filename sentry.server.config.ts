import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Keys that are routinely attached to error context and should be promoted
// from `extra` (blob) to `tags` (searchable in Sentry) so ops can filter by
// them. Add entries sparingly — tags have low cardinality budgets.
const PROMOTE_TO_TAG = new Set([
  "route",
  "userId",
  "botId",
  "threadId",
  "provider",
  "modelId",
  "slug",
  "scope",
]);

// PII / secret patterns that must NEVER be reported.
const SECRET_PATTERNS = [
  /sk[-_][a-z0-9]+/i,
  /sk-ant-[a-z0-9-]+/i,
  /xai-[a-z0-9-]+/i,
  /aiza[a-z0-9-_]+/i, // google api key prefix
  /bearer\s+[a-z0-9._-]+/i,
];

function scrubString(s: string): string {
  let out = s;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "<redacted>");
  return out;
}

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      // 1. Promote known keys from `extra` to `tags` so they become filterable.
      const extra = event.extra ?? {};
      for (const key of Object.keys(extra)) {
        if (!PROMOTE_TO_TAG.has(key)) continue;
        const v = extra[key];
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          event.tags = { ...event.tags, [key]: String(v) };
        }
      }
      // 2. Scrub obvious secrets from the message + exception strings.
      if (typeof event.message === "string") event.message = scrubString(event.message);
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (typeof ex.value === "string") ex.value = scrubString(ex.value);
        }
      }
      return event;
    },
  });
}
