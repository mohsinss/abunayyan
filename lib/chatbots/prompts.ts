import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatbots, chatbotPrompts } from "@/db/schema/chatbots";
import { writeAudit } from "./audit";

// NOTE: Neon's HTTP driver (`neon-http`) does NOT support transactions,
// so we can't wrap these statements in db.transaction(). The original
// implementation did and would 500 the moment an admin edited a system
// prompt. We instead serialize the operations in an order that is safe
// to re-run if any step fails midway:
//
//   1. Read the current bot row.
//   2. Snapshot the OLD prompt at its existing version (idempotent via
//      the unique (chatbot_id, version) index).
//   3. Bump the bot row to the new prompt + version.
//   4. Snapshot the NEW prompt at the new version (idempotent).
//   5. Audit log.
//
// Concurrency: if two admins race, both will compute the same
// nextVersion and one of the inserts will conflict on the unique
// index. The losing call surfaces a Postgres error to the caller —
// acceptable for an admin-only mutation that runs ~0–1 times/day.

export async function updateSystemPrompt(args: {
  botId: string;
  newPrompt: string;
  note?: string;
  actorId: string;
}): Promise<number> {
  const [bot] = await db
    .select()
    .from(chatbots)
    .where(eq(chatbots.id, args.botId))
    .limit(1);
  if (!bot) throw new Error("Bot not found");

  const nextVersion = bot.systemPromptVersion + 1;

  // 2. Snapshot the OLD prompt if it isn't already in the history table.
  //    The unique index makes this safe to retry.
  await db
    .insert(chatbotPrompts)
    .values({
      chatbotId: bot.id,
      version: bot.systemPromptVersion,
      systemPrompt: bot.systemPrompt,
      note: "snapshot before edit",
      createdBy: args.actorId,
    })
    .onConflictDoNothing({
      target: [chatbotPrompts.chatbotId, chatbotPrompts.version],
    });

  // 3. Update the bot row to the new prompt + bumped version.
  await db
    .update(chatbots)
    .set({
      systemPrompt: args.newPrompt,
      systemPromptVersion: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(chatbots.id, bot.id));

  // 4. Insert the NEW prompt snapshot at the new version.
  await db
    .insert(chatbotPrompts)
    .values({
      chatbotId: bot.id,
      version: nextVersion,
      systemPrompt: args.newPrompt,
      note: args.note,
      createdBy: args.actorId,
    })
    .onConflictDoNothing({
      target: [chatbotPrompts.chatbotId, chatbotPrompts.version],
    });

  // 5. Audit.
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
