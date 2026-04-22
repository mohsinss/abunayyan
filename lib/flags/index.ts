import "server-only";
import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

const client = env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
    })
  : null;

export async function isFeatureEnabled(flagKey: string, distinctId: string): Promise<boolean> {
  if (!client) return false;
  return (await client.isFeatureEnabled(flagKey, distinctId)) ?? false;
}

export async function getFeaturePayload<T = unknown>(
  flagKey: string,
  distinctId: string,
): Promise<T | null> {
  if (!client) return null;
  return (await client.getFeatureFlagPayload(flagKey, distinctId)) as T | null;
}
