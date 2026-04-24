import { describe, expect, it } from "vitest";
import { generateShareToken } from "@/lib/datasets/share";

describe("generateShareToken", () => {
  it("returns a URL-safe base64 string", () => {
    const t = generateShareToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("yields 256 bits of entropy (~43 base64url chars)", () => {
    const t = generateShareToken();
    // 32 bytes -> 43 chars base64url, no padding.
    expect(t.length).toBeGreaterThanOrEqual(42);
    expect(t.length).toBeLessThanOrEqual(44);
  });

  it("doesn't collide across 1000 iterations", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateShareToken());
    expect(set.size).toBe(1000);
  });
});
