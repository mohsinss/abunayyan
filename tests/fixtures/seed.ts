import { getTestDb } from "./pglite";
import { users, type User } from "@/db/schema/users";
import { chatbots, type Chatbot } from "@/db/schema/chatbots";

// Minimal valid-row seeders for the PGlite fixture. Tables truncate between
// tests (resetTestDb), so fixed ids/slugs are safe to reuse.

export async function seedUser(overrides: Partial<User> = {}): Promise<User> {
  const { db } = await getTestDb();
  const [u] = await db
    .insert(users)
    .values({ id: "u1", email: "u1@test.dev", ...overrides })
    .returning();
  return u!;
}

export async function seedBot(overrides: Partial<Chatbot> = {}): Promise<Chatbot> {
  const { db } = await getTestDb();
  const [b] = await db
    .insert(chatbots)
    .values({
      slug: "test-bot",
      name: "Test Bot",
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
      systemPrompt: "you are a test bot",
      ...overrides,
    })
    .returning();
  return b!;
}
