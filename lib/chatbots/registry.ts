import "server-only";
import { cache } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chatbots, type Chatbot } from "@/db/schema/chatbots";

export const getBotBySlug = cache(async (slug: string): Promise<Chatbot | null> => {
  const [bot] = await db
    .select()
    .from(chatbots)
    .where(and(eq(chatbots.slug, slug), isNull(chatbots.deletedAt)))
    .limit(1);
  return bot ?? null;
});

export const getBotById = cache(async (id: string): Promise<Chatbot | null> => {
  const [bot] = await db
    .select()
    .from(chatbots)
    .where(and(eq(chatbots.id, id), isNull(chatbots.deletedAt)))
    .limit(1);
  return bot ?? null;
});

export const listBots = cache(async (): Promise<Chatbot[]> => {
  return db
    .select()
    .from(chatbots)
    .where(isNull(chatbots.deletedAt))
    .orderBy(chatbots.name);
});

export const listEnabledBotsForRole = cache(
  async (role: string): Promise<Chatbot[]> => {
    const all = await listBots();
    return all.filter((b) => {
      if (!b.enabled) return false;
      const allowed = b.allowedRoles ?? [];
      if (allowed.length === 0) return true;
      return allowed.includes(role as never);
    });
  },
);
