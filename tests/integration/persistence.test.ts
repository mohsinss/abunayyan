// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Point the modules under test at the PGlite-backed db. The schema barrel
// has no side effects (no env, no neon client), so spreading it keeps every
// table export intact while overriding `db`.
vi.mock("@/db", async () => {
  const schema = await vi.importActual<Record<string, unknown>>("@/db/schema");
  const { getTestDb } = await import("../fixtures/pglite");
  const { db } = await getTestDb();
  return { ...schema, db };
});

import { resetTestDb } from "../fixtures/pglite";
import { seedUser, seedBot } from "../fixtures/seed";
import {
  getOrCreateThread,
  appendMessage,
  getMessagesForThread,
  getThreadForUser,
  softDeleteThread,
  listThreadsForUser,
  listThreadsForBot,
  listThreadsWithBotForUser,
  autoTitleIfNeeded,
  toUIMessage,
  toUIMessages,
} from "@/lib/chatbots/persistence";
import type { Message } from "@/db/schema/messages";

beforeEach(async () => {
  await resetTestDb();
});

async function freshThread() {
  const user = await seedUser();
  const bot = await seedBot();
  const thread = await getOrCreateThread({ userId: user.id, chatbotId: bot.id });
  return { user, bot, thread };
}

describe("getOrCreateThread", () => {
  it("creates a new thread when no id is given", async () => {
    const { thread, user, bot } = await freshThread();
    expect(thread.id).toBeTruthy();
    expect(thread.userId).toBe(user.id);
    expect(thread.chatbotId).toBe(bot.id);
    expect(thread.title).toBeNull();
  });

  it("reuses an existing thread owned by the same user", async () => {
    const { thread, user, bot } = await freshThread();
    const again = await getOrCreateThread({
      userId: user.id,
      chatbotId: bot.id,
      threadId: thread.id,
    });
    expect(again.id).toBe(thread.id);
  });

  it("creates a new thread when the id belongs to another user", async () => {
    const { thread, bot } = await freshThread();
    const intruder = await seedUser({ id: "u2", email: "u2@test.dev" });
    const created = await getOrCreateThread({
      userId: intruder.id,
      chatbotId: bot.id,
      threadId: thread.id, // not theirs → ignored
    });
    expect(created.id).not.toBe(thread.id);
    expect(created.userId).toBe(intruder.id);
  });
});

describe("appendMessage", () => {
  it("inserts a message and bumps the thread's updatedAt", async () => {
    const { thread } = await freshThread();
    const before = await getThreadForUser(thread.id, thread.userId);

    await appendMessage({ threadId: thread.id, role: "user", content: "hello" });
    await appendMessage({
      threadId: thread.id,
      role: "assistant",
      content: "hi there",
      tokensIn: 10,
      tokensOut: 5,
    });

    const msgs = await getMessagesForThread(thread.id);
    expect(msgs.map((m) => m.content)).toEqual(["hello", "hi there"]);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[1].status).toBe("complete");

    const after = await getThreadForUser(thread.id, thread.userId);
    expect(after!.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime());
  });

  it("returns messages in createdAt order", async () => {
    const { thread } = await freshThread();
    for (const c of ["a", "b", "c"]) {
      await appendMessage({ threadId: thread.id, role: "user", content: c });
    }
    const msgs = await getMessagesForThread(thread.id);
    expect(msgs.map((m) => m.content)).toEqual(["a", "b", "c"]);
  });
});

describe("autoTitleIfNeeded", () => {
  it("sets the title from the first message, truncated to 80 chars", async () => {
    const { thread } = await freshThread();
    const long = "x".repeat(200);
    await autoTitleIfNeeded(thread.id, long);
    const row = await getThreadForUser(thread.id, thread.userId);
    expect(row!.title).toBe("x".repeat(80));
  });

  it("does not overwrite an existing title", async () => {
    const { thread } = await freshThread();
    await autoTitleIfNeeded(thread.id, "first title");
    await autoTitleIfNeeded(thread.id, "second title");
    const row = await getThreadForUser(thread.id, thread.userId);
    expect(row!.title).toBe("first title");
  });

  it("is a no-op for a blank message", async () => {
    const { thread } = await freshThread();
    await autoTitleIfNeeded(thread.id, "   ");
    const row = await getThreadForUser(thread.id, thread.userId);
    expect(row!.title).toBeNull();
  });
});

describe("softDeleteThread + listThreadsForUser", () => {
  it("hides soft-deleted threads from the user's list, scoped to the owner", async () => {
    const { thread, user, bot } = await freshThread();
    const second = await getOrCreateThread({ userId: user.id, chatbotId: bot.id });
    expect((await listThreadsForUser(user.id)).length).toBe(2);

    // Another user can't delete it.
    await softDeleteThread(thread.id, "someone-else");
    expect((await listThreadsForUser(user.id)).length).toBe(2);

    await softDeleteThread(thread.id, user.id);
    const remaining = await listThreadsForUser(user.id);
    expect(remaining.map((t) => t.id)).toEqual([second.id]);
  });
});

describe("listThreadsForBot", () => {
  it("returns all threads for a bot regardless of owner", async () => {
    const u1 = await seedUser();
    const u2 = await seedUser({ id: "u2", email: "u2@test.dev" });
    const bot = await seedBot();
    await getOrCreateThread({ userId: u1.id, chatbotId: bot.id });
    await getOrCreateThread({ userId: u2.id, chatbotId: bot.id });
    const rows = await listThreadsForBot(bot.id);
    expect(rows).toHaveLength(2);
  });
});

describe("listThreadsWithBotForUser", () => {
  it("joins the bot slug/name and excludes soft-deleted threads", async () => {
    const user = await seedUser();
    const bot = await seedBot({ slug: "joined", name: "Joined Bot" });
    const keep = await getOrCreateThread({ userId: user.id, chatbotId: bot.id });
    const gone = await getOrCreateThread({ userId: user.id, chatbotId: bot.id });
    await softDeleteThread(gone.id, user.id);

    const rows = await listThreadsWithBotForUser(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: keep.id, botSlug: "joined", botName: "Joined Bot" });
  });
});

describe("toUIMessages", () => {
  it("maps a list of stored messages", () => {
    const out = toUIMessages([
      { id: "a", role: "user", content: "hi", toolCalls: null, createdAt: new Date() },
      { id: "b", role: "assistant", content: "yo", toolCalls: null, createdAt: new Date() },
    ] as unknown as Message[]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("toUIMessage", () => {
  it("promotes stored tool calls to result-state tool invocations", () => {
    const ui = toUIMessage({
      id: "m1",
      role: "assistant",
      content: "see chart",
      toolCalls: [{ toolCallId: "tc1", toolName: "renderChart", args: { a: 1 } }],
      createdAt: new Date(),
    } as unknown as Message);
    expect(ui.toolInvocations).toHaveLength(1);
    expect(ui.toolInvocations![0]).toMatchObject({
      state: "result",
      toolName: "renderChart",
      result: { a: 1 },
    });
  });

  it("omits toolInvocations when there are none", () => {
    const ui = toUIMessage({
      id: "m2",
      role: "user",
      content: "hi",
      toolCalls: null,
      createdAt: new Date(),
    } as unknown as Message);
    expect(ui.toolInvocations).toBeUndefined();
  });
});
