import { describe, expect, it } from "vitest";
import { canUserAccessBot } from "@/lib/chatbots/authz";

function bot(overrides: Partial<{
  allowedRoles: ("owner" | "admin" | "manager" | "member" | "viewer")[];
  enabled: boolean;
  deletedAt: Date | null;
}> = {}) {
  return {
    allowedRoles: [],
    enabled: true,
    deletedAt: null,
    ...overrides,
  };
}

describe("canUserAccessBot", () => {
  it("rejects a disabled user even if the bot is open to all", () => {
    expect(canUserAccessBot({ role: "admin", disabled: true }, bot())).toBe(false);
  });

  it("rejects a disabled bot even for admins", () => {
    expect(
      canUserAccessBot({ role: "admin", disabled: false }, bot({ enabled: false })),
    ).toBe(false);
  });

  it("rejects a soft-deleted bot", () => {
    expect(
      canUserAccessBot(
        { role: "admin", disabled: false },
        bot({ deletedAt: new Date() }),
      ),
    ).toBe(false);
  });

  it("allows any authenticated role when allowedRoles is empty", () => {
    for (const role of ["owner", "admin", "manager", "member", "viewer"] as const) {
      expect(canUserAccessBot({ role, disabled: false }, bot())).toBe(true);
    }
  });

  it("enforces allowedRoles when populated", () => {
    const b = bot({ allowedRoles: ["admin", "manager"] });
    expect(canUserAccessBot({ role: "viewer", disabled: false }, b)).toBe(false);
    expect(canUserAccessBot({ role: "member", disabled: false }, b)).toBe(false);
    expect(canUserAccessBot({ role: "manager", disabled: false }, b)).toBe(true);
    expect(canUserAccessBot({ role: "admin", disabled: false }, b)).toBe(true);
  });

  it("does NOT grant admins access to a bot they are not in allowedRoles for", () => {
    // allowedRoles is an allow-list, not a minimum rank — admin must be in it.
    const b = bot({ allowedRoles: ["member"] });
    expect(canUserAccessBot({ role: "admin", disabled: false }, b)).toBe(false);
  });
});
