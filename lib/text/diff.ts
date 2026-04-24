export type DiffKind = "same" | "add" | "del";

export type DiffLine = {
  kind: DiffKind;
  line: string;
  /** 1-based index in the old text (absent for inserted lines). */
  oldLineNo?: number;
  /** 1-based index in the new text (absent for deleted lines). */
  newLineNo?: number;
};

/**
 * Line-level LCS diff. Returns a flat unified sequence of same/add/del
 * lines. Good enough for prompt-level comparisons (a few dozen lines);
 * for larger blobs swap in Myers.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  // Treat an empty string as zero lines (intuitive), not one empty line
  // (which is what a naive `.split("\n")` gives us).
  const oldLines = before.length === 0 ? [] : before.split("\n");
  const newLines = after.length === 0 ? [] : after.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // LCS length table built bottom-up so we can walk top-down greedily.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      out.push({ kind: "same", line: oldLines[i]!, oldLineNo: i + 1, newLineNo: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: "del", line: oldLines[i]!, oldLineNo: i + 1 });
      i++;
    } else {
      out.push({ kind: "add", line: newLines[j]!, newLineNo: j + 1 });
      j++;
    }
  }
  while (i < m) {
    out.push({ kind: "del", line: oldLines[i]!, oldLineNo: i + 1 });
    i++;
  }
  while (j < n) {
    out.push({ kind: "add", line: newLines[j]!, newLineNo: j + 1 });
    j++;
  }
  return out;
}

/** Count of added / deleted lines (same lines excluded). */
export function diffCounts(d: DiffLine[]): { added: number; deleted: number } {
  let added = 0;
  let deleted = 0;
  for (const row of d) {
    if (row.kind === "add") added++;
    else if (row.kind === "del") deleted++;
  }
  return { added, deleted };
}
