// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/db", async () => {
  const schema = await vi.importActual<Record<string, unknown>>("@/db/schema");
  const { getTestDb } = await import("../fixtures/pglite");
  const { db } = await getTestDb();
  return { ...schema, db };
});

import { getTestDb, resetTestDb } from "../fixtures/pglite";
import { seedUser, seedBot } from "../fixtures/seed";
import { writeAudit } from "@/lib/chatbots/audit";
import { auditLog } from "@/db/schema/audit-log";

beforeEach(async () => {
  await resetTestDb();
});

describe("writeAudit", () => {
  it("inserts an entry with the typed event and a JSON payload that round-trips", async () => {
    const actor = await seedUser();
    const bot = await seedBot();
    await writeAudit({
      actorId: actor.id,
      botId: bot.id,
      event: "bot.prompt_updated",
      payload: { fromVersion: 1, toVersion: 2, note: "x" },
    });

    const { db } = await getTestDb();
    const rows = await db.select().from(auditLog).where(eq(auditLog.actorId, actor.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].event).toBe("bot.prompt_updated");
    expect(rows[0].botId).toBe(bot.id);
    expect(rows[0].payload).toEqual({ fromVersion: 1, toVersion: 2, note: "x" });
  });

  it("accepts null actor/bot (system events) and defaults payload to null", async () => {
    await writeAudit({ event: "bot.access_denied" });
    const { db } = await getTestDb();
    const rows = await db.select().from(auditLog);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBeNull();
    expect(rows[0].botId).toBeNull();
    expect(rows[0].payload).toBeNull();
  });
});
