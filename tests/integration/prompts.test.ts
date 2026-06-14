// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const schema = await vi.importActual<Record<string, unknown>>("@/db/schema");
  const { getTestDb } = await import("../fixtures/pglite");
  const { db } = await getTestDb();
  return { ...schema, db };
});

import { resetTestDb } from "../fixtures/pglite";
import { seedUser, seedBot } from "../fixtures/seed";
import {
  updateSystemPrompt,
  rollbackSystemPrompt,
  listPromptHistory,
} from "@/lib/chatbots/prompts";
import { getBotById } from "@/lib/chatbots/registry";

beforeEach(async () => {
  await resetTestDb();
});

async function setup() {
  const actor = await seedUser();
  const bot = await seedBot({ systemPrompt: "v1 prompt", systemPromptVersion: 1 });
  return { actor, bot };
}

describe("updateSystemPrompt", () => {
  it("bumps the bot version and snapshots both old and new prompts", async () => {
    const { actor, bot } = await setup();
    const newVersion = await updateSystemPrompt({
      botId: bot.id,
      newPrompt: "v2 prompt",
      note: "tighten tone",
      actorId: actor.id,
    });
    expect(newVersion).toBe(2);

    const updated = await getBotById(bot.id);
    expect(updated!.systemPrompt).toBe("v2 prompt");
    expect(updated!.systemPromptVersion).toBe(2);

    const history = await listPromptHistory(bot.id);
    expect(history.map((h) => h.version)).toEqual([2, 1]); // desc
    expect(history.find((h) => h.version === 1)!.systemPrompt).toBe("v1 prompt");
    expect(history.find((h) => h.version === 2)!.systemPrompt).toBe("v2 prompt");
  });
});

describe("rollbackSystemPrompt", () => {
  it("restores an earlier prompt as a new forward version (non-destructive)", async () => {
    const { actor, bot } = await setup();
    await updateSystemPrompt({ botId: bot.id, newPrompt: "v2 prompt", actorId: actor.id });
    const rolledVersion = await rollbackSystemPrompt({
      botId: bot.id,
      toVersion: 1,
      actorId: actor.id,
    });
    expect(rolledVersion).toBe(3); // forward bump, not a rewind

    const updated = await getBotById(bot.id);
    expect(updated!.systemPrompt).toBe("v1 prompt"); // content restored
    expect(updated!.systemPromptVersion).toBe(3);

    const history = await listPromptHistory(bot.id);
    expect(history.map((h) => h.version)).toEqual([3, 2, 1]); // nothing deleted
  });

  it("throws when the target version does not exist", async () => {
    const { actor, bot } = await setup();
    await expect(
      rollbackSystemPrompt({ botId: bot.id, toVersion: 99, actorId: actor.id }),
    ).rejects.toThrow(/version 99/);
  });
});
