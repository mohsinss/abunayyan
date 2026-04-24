import "server-only";
import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

const client = env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  : null;

export const EVENTS = {
  user_signed_up: "user_signed_up",
  project_created: "project_created",
  project_analyzed: "project_analyzed",
  checkout_started: "checkout_started",
  checkout_succeeded: "checkout_succeeded",
  subscription_cancelled: "subscription_cancelled",
  ai_completion: "ai_completion",

  // Dataset-card lifecycle (docs/datasets-cards-plan.md).
  dataset_created: "dataset_created",
  dataset_file_uploaded: "dataset_file_uploaded",
  dataset_proposed: "dataset_proposed",
  dataset_generated: "dataset_generated",
  dataset_share_enabled: "dataset_share_enabled",
  dataset_share_disabled: "dataset_share_disabled",
  dataset_share_rotated: "dataset_share_rotated",
  dataset_public_chat_sent: "dataset_public_chat_sent",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export async function capture(opts: {
  distinctId: string;
  event: EventName;
  properties?: Record<string, unknown>;
}) {
  if (!client) return;
  client.capture({
    distinctId: opts.distinctId,
    event: opts.event,
    properties: opts.properties,
  });
  await client.flush();
}

export async function shutdownPostHog() {
  await client?.shutdown();
}
