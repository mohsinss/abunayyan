import { describe, it, expect } from "vitest";
import { createProjectSchema, createCheckoutSchema } from "@/lib/validation/schemas";

describe("createProjectSchema", () => {
  it("accepts a valid project", () => {
    const r = createProjectSchema.safeParse({
      name: "Acme",
      description: "x".repeat(20),
      budget: 5000,
      timeline: "Q2",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = createProjectSchema.safeParse({ name: "" });
    expect(r.success).toBe(false);
  });
});

describe("createCheckoutSchema", () => {
  it("requires priceId starting with price_", () => {
    expect(createCheckoutSchema.safeParse({ priceId: "bad" }).success).toBe(false);
    expect(createCheckoutSchema.safeParse({ priceId: "price_123" }).success).toBe(true);
  });
});
