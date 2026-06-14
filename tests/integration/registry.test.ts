// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const schema = await vi.importActual<Record<string, unknown>>("@/db/schema");
  const { getTestDb } = await import("../fixtures/pglite");
  const { db } = await getTestDb();
  return { ...schema, db };
});
// registry wraps queries in React cache(); make it a pass-through so the
// memo scope doesn't leak stale rows across tests (each test truncates).
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import { resetTestDb } from "../fixtures/pglite";
import { seedBot } from "../fixtures/seed";
import {
  getBotBySlug,
  getBotById,
  listBots,
  listEnabledBotsForRole,
} from "@/lib/chatbots/registry";

beforeEach(async () => {
  await resetTestDb();
});

describe("getBotBySlug / getBotById", () => {
  it("returns a live bot by slug and by id", async () => {
    const bot = await seedBot({ slug: "alpha" });
    expect((await getBotBySlug("alpha"))?.id).toBe(bot.id);
    expect((await getBotById(bot.id))?.slug).toBe("alpha");
  });

  it("excludes soft-deleted bots", async () => {
    const bot = await seedBot({ slug: "gone", deletedAt: new Date() });
    expect(await getBotBySlug("gone")).toBeNull();
    expect(await getBotById(bot.id)).toBeNull();
  });

  it("returns null for an unknown slug", async () => {
    expect(await getBotBySlug("nope")).toBeNull();
  });
});

describe("listBots", () => {
  it("lists live bots ordered by name, excluding deleted", async () => {
    await seedBot({ slug: "b", name: "Beta" });
    await seedBot({ slug: "a", name: "Alpha" });
    await seedBot({ slug: "d", name: "Deleted", deletedAt: new Date() });
    const names = (await listBots()).map((b) => b.name);
    expect(names).toEqual(["Alpha", "Beta"]);
  });
});

describe("listEnabledBotsForRole", () => {
  it("filters by enabled flag and allowedRoles", async () => {
    await seedBot({ slug: "open", name: "Open", allowedRoles: [] }); // all roles
    await seedBot({ slug: "off", name: "Off", enabled: false });
    await seedBot({ slug: "adminonly", name: "Admins", allowedRoles: ["admin"] });

    const forMember = (await listEnabledBotsForRole("member")).map((b) => b.slug);
    expect(forMember).toEqual(["open"]);

    const forAdmin = (await listEnabledBotsForRole("admin")).map((b) => b.slug).sort();
    expect(forAdmin).toEqual(["adminonly", "open"]);
  });
});
