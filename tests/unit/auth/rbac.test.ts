import { describe, expect, it } from "vitest";
import { hasRole, canChangeRoleTo } from "@/lib/auth/rbac";

describe("hasRole", () => {
  it("returns false for undefined role", () => {
    expect(hasRole(undefined, "member")).toBe(false);
  });

  it("is monotonic along the rank ladder", () => {
    // Owner outranks everything.
    expect(hasRole("owner", "viewer")).toBe(true);
    expect(hasRole("owner", "admin")).toBe(true);
    // Member outranks viewer but not manager.
    expect(hasRole("member", "viewer")).toBe(true);
    expect(hasRole("member", "manager")).toBe(false);
    // A role satisfies its own requirement.
    expect(hasRole("admin", "admin")).toBe(true);
  });
});

describe("canChangeRoleTo", () => {
  const owner = { id: "u-owner", role: "owner" as const };
  const admin = { id: "u-admin", role: "admin" as const };
  const manager = { id: "u-manager", role: "manager" as const };
  const member = { id: "u-member", role: "member" as const };

  it("lets owner promote a member to admin", () => {
    const r = canChangeRoleTo(owner, member, "admin");
    expect(r.ok).toBe(true);
  });

  it("blocks a non-owner from promoting anyone to admin", () => {
    const r = canChangeRoleTo(admin, member, "admin");
    expect(r.ok).toBe(false);
  });

  it("blocks a non-owner from demoting another admin", () => {
    const r = canChangeRoleTo(admin, { id: "u-other-admin", role: "admin" }, "member");
    expect(r.ok).toBe(false);
  });

  it("blocks any non-owner from creating owner", () => {
    const r = canChangeRoleTo(admin, member, "owner");
    expect(r.ok).toBe(false);
  });

  it("blocks self-demotion below admin", () => {
    const r = canChangeRoleTo(admin, admin, "member");
    expect(r.ok).toBe(false);
  });

  it("allows admin to change non-admin role", () => {
    const r = canChangeRoleTo(admin, manager, "member");
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown role string", () => {
    // @ts-expect-error intentionally passing an invalid role
    const r = canChangeRoleTo(admin, member, "god");
    expect(r.ok).toBe(false);
  });
});
