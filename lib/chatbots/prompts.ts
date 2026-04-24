import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatbots, chatbotPrompts } from "@/db/schema/chatbots";
import { writeAudit } from "./audit";

export async function updateSystemPrompt(args: {
  botId: string;
  newPrompt: string;
  note?: string;
  actorId: string;
}): Promise<number> {
  return db.transaction(async (tx) => {
    const [bot] = await tx
      .select()
      .from(chatbots)
      .where(eq(chatbots.id, args.botId))
      .for("update")
      .limit(1);
    if (!bot) throw new Error("Bot not found");

    const nextVersion = bot.systemPromptVersion + 1;

    const [existing] = await tx
      .select({ v: chatbotPrompts.version })
      .from(chatbotPrompts)
      .where(eq(chatbotPrompts.chatbotId, bot.id))
      .orderBy(desc(chatbotPrompts.version))
      .limit(1);
    if (!existing || existing.v !== bot.systemPromptVersion) {
      await tx.insert(chatbotPrompts).values({
        chatbotId: bot.id,
        version: bot.systemPromptVersion,
        systemPrompt: bot.systemPrompt,
        note: "snapshot before edit",
        createdBy: args.actorId,
      });
    }

    await tx
      .update(chatbots)
      .set({
        systemPrompt: args.newPrompt,
        systemPromptVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, bot.id));

    await tx.insert(chatbotPrompts).values({
      chatbotId: bot.id,
      version: nextVersion,
      systemPrompt: args.newPrompt,
      note: args.note,
      createdBy: args.actorId,
    });

    await writeAudit({
      actorId: args.actorId,
      botId: bot.id,
      event: "bot.prompt_updated",
      payload: {
        fromVersion: bot.systemPromptVersion,
        toVersion: nextVersion,
        note: args.note,
      },
    });

    return nextVersion;
  });
}

export async function rollbackSystemPrompt(args: {
  botId: string;
  toVersion: number;
  actorId: string;
}) {
  const [snap] = await db
    .select()
    .from(chatbotPrompts)
    .where(
      and(
        eq(chatbotPrompts.chatbotId, args.botId),
        eq(chatbotPrompts.version, args.toVersion),
      ),
    )
    .limit(1);
  if (!snap) throw new Error(`No prompt at version ${args.toVersion}`);
  return updateSystemPrompt({
    botId: args.botId,
    newPrompt: snap.systemPrompt,
    note: `rollback to v${args.toVersion}`,
    actorId: args.actorId,
  });
}

export async function listPromptHistory(botId: string) {
  return db
    .select()
    .from(chatbotPrompts)
    .where(eq(chatbotPrompts.chatbotId, botId))
    .orderBy(desc(chatbotPrompts.version));
}
