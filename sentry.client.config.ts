import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

const PROMOTE_TO_TAG = new Set([
  "route",
  "userId",
  "botId",
  "threadId",
  "provider",
  "modelId",
  "slug",
  "scope",
  "error_boundary",
]);

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],
    beforeSend(event) {
      const extra = event.extra ?? {};
      for (const key of Object.keys(extra)) {
        if (!PROMOTE_TO_TAG.has(key)) continue;
        const v = extra[key];
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          event.tags = { ...event.tags, [key]: String(v) };
        }
      }
      return event;
    },
  });
}
