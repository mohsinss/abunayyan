import { test as setup } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema/users";
import { sessions } from "@/db/schema/sessions";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(HERE, ".auth");
const ADMIN_FILE = path.join(AUTH_DIR, "admin.json");
const MEMBER_FILE = path.join(AUTH_DIR, "member.json");

const DB_URL = process.env.DATABASE_URL;

// Guard: authenticated E2Es need a real DB. Run via
// `pnpm test:e2e:authenticated` which loads .env.local.
if (!DB_URL || DB_URL.includes("placeholder")) {
  throw new Error(
    "Authenticated E2E requires DATABASE_URL from .env.local. " +
      "Use `pnpm test:e2e:authenticated` to load it automatically.",
  );
}

const sql = neon(DB_URL);
const db = drizzle(sql, { schema: { users, sessions } });

const E2E_USER_PREFIX = "e2e-playwright-";

type TestRole = "owner" | "admin" | "member" | "viewer";

async function upsertUser(id: string, email: string, role: TestRole) {
  await db
    .insert(users)
    .values({ id, email, name: `E2E ${role}`, role, disabled: false })
    .onConflictDoNothing();
  // Force role + un-disable in case a previous run left state.
  await db.update(users).set({ role, disabled: false }).where(eq(users.id, id));
}

async function issueSession(userId: string): Promise<string> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  const token = crypto.randomUUID();
  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expires: new Date(Date.now() + 4 * 60 * 60 * 1000),
  });
  return token;
}

function writeStorageState(file: string, token: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const state = {
    cookies: [
      {
        name: "authjs.session-token",
        value: token,
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// Setup tests run serially, one per project, before the test projects.
// We deliberately do NOT use `page` here so these run without a browser
// install — state is written directly to the JSON file that Playwright
// loads via `use.storageState` in the authenticated projects.

setup("seed + storageState for admin/owner", async () => {
  const id = `${E2E_USER_PREFIX}admin`;
  await upsertUser(id, `${id}@test.local`, "owner");
  const token = await issueSession(id);
  writeStorageState(ADMIN_FILE, token);
});

setup("seed + storageState for member", async () => {
  const id = `${E2E_USER_PREFIX}member`;
  await upsertUser(id, `${id}@test.local`, "member");
  const token = await issueSession(id);
  writeStorageState(MEMBER_FILE, token);
});
