import "server-only";
import { redis } from "@/lib/ratelimit/redis";

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (!redis) return loader();
  const hit = await redis.get<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await loader();
  await redis.set(key, value, { ex: ttlSeconds });
  return value;
}

export async function invalidate(key: string) {
  if (!redis) return;
  await redis.del(key);
}
