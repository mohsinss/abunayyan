import "server-only";
import pino from "pino";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function captureError(err: unknown, context?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error({ err, ...context }, message);
  if (env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(err, { extra: context });
  }
}
