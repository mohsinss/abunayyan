import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chatbots, chatbotPrompts, type NewChatbot } from "@/db/schema/chatbots";

export async function createChatbot(values: NewChatbot, actorId: string) {
  const [row] = await db.insert(chatbots).values(values).returning();
  if (!row) throw new Error("Insert returned no row");
  await db.insert(chatbotPrompts).values({
    chatbotId: row.id,
    version: row.systemPromptVersion,
    systemPrompt: row.systemPrompt,
    note: "initial",
    createdBy: actorId,
  });
  return row;
}

export async function updateChatbot(
  id: string,
  values: Partial<NewChatbot>,
): Promise<boolean> {
  const res = await db
    .update(chatbots)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(chatbots.id, id), isNull(chatbots.deletedAt)))
    .returning();
  return res.length > 0;
}

export async function softDeleteChatbot(id: string) {
  await db
    .update(chatbots)
    .set({ enabled: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(chatbots.id, id));
}
