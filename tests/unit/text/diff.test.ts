import { describe, expect, it } from "vitest";
import { diffCounts, diffLines } from "@/lib/text/diff";

describe("diffLines", () => {
  it("returns all `same` when inputs are identical", () => {
    const d = diffLines("one\ntwo\nthree", "one\ntwo\nthree");
    expect(d.every((r) => r.kind === "same")).toBe(true);
    expect(d.length).toBe(3);
  });

  it("marks a pure insertion", () => {
    const d = diffLines("a\nc", "a\nb\nc");
    expect(d.map((r) => r.kind)).toEqual(["same", "add", "same"]);
    expect(d[1]!.line).toBe("b");
    expect(d[1]!.newLineNo).toBe(2);
  });

  it("marks a pure deletion", () => {
    const d = diffLines("a\nb\nc", "a\nc");
    expect(d.map((r) => r.kind)).toEqual(["same", "del", "same"]);
    expect(d[1]!.line).toBe("b");
    expect(d[1]!.oldLineNo).toBe(2);
  });

  it("handles a replacement as del + add", () => {
    const d = diffLines("alpha\nbeta\ngamma", "alpha\nBETA\ngamma");
    const kinds = d.map((r) => r.kind);
    // At least one del and one add, the two same lines are anchors.
    expect(kinds.filter((k) => k === "del").length).toBe(1);
    expect(kinds.filter((k) => k === "add").length).toBe(1);
  });

  it("handles an empty old text (all inserts)", () => {
    const d = diffLines("", "first\nsecond");
    expect(d.map((r) => r.kind)).toEqual(["add", "add"]);
  });

  it("handles an empty new text (all deletes)", () => {
    const d = diffLines("first\nsecond", "");
    expect(d.map((r) => r.kind)).toEqual(["del", "del"]);
  });

  it("attaches 1-based line numbers on both sides", () => {
    const d = diffLines("a\nb", "a\nB");
    const same = d.find((r) => r.kind === "same")!;
    expect(same.oldLineNo).toBe(1);
    expect(same.newLineNo).toBe(1);
  });
});

describe("diffCounts", () => {
  it("counts adds and deletes", () => {
    const d = diffLines("a\nb\nc", "a\nX\nY\nc");
    expect(diffCounts(d)).toEqual({ added: 2, deleted: 1 });
  });
  it("is zero on identity", () => {
    expect(diffCounts(diffLines("same", "same"))).toEqual({ added: 0, deleted: 0 });
  });
});
