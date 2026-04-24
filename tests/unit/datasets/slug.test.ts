import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/datasets/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("collapses non-alphanumeric runs", () => {
    expect(slugify("Q1 — 2026 Supplier Spend!!")).toBe("q1-2026-supplier-spend");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("-leading and trailing-")).toBe("leading-and-trailing");
  });

  it("strips diacritics", () => {
    expect(slugify("Café résumé")).toBe("cafe-resume");
  });

  it("falls back to 'dataset' for empty or all-symbol input", () => {
    expect(slugify("")).toBe("dataset");
    expect(slugify("!!!")).toBe("dataset");
  });

  it("caps length at 80 chars", () => {
    const s = slugify("a".repeat(200));
    expect(s.length).toBeLessThanOrEqual(80);
  });
});

describe("uniqueSlug", () => {
  it("returns base when no collision", async () => {
    const s = await uniqueSlug("My Dataset", async () => false);
    expect(s).toBe("my-dataset");
  });

  it("appends a suffix on collision", async () => {
    let calls = 0;
    const s = await uniqueSlug("My Dataset", async () => {
      calls++;
      return calls === 1; // first call (base) exists, next available
    });
    expect(s).toMatch(/^my-dataset-[a-z0-9]{5}$/);
  });
});
