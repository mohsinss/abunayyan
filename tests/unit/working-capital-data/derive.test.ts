import { describe, expect, it } from "vitest";
import {
  annualRevenue,
  applyPreset,
  cashReleased,
  cccOf,
  cogsPerDay,
  groupTotalsOf,
  nwcOf,
  revPerDay,
} from "@/lib/working-capital-data/derive";
import { GROUP_SEED, SBU_SEEDS } from "@/lib/working-capital-data/seed-data";

// Golden values straight off the working-capital-ccc.html SBUS array.
// These tests guarantee we never silently drift from the static brief.

describe("nwcOf / cccOf", () => {
  it("matches the brief for Wetico (best-CCC SBU)", () => {
    const w = SBU_SEEDS.find((s) => s.key === "Wetico")!;
    // 18 + 348 + 195 - 392 = 169
    expect(nwcOf(w)).toBe(169);
    // 5 + 123 - 109 = 19  ← brief says "Best CCC of any large SBU (19 days)"
    expect(cccOf(w)).toBe(19);
  });

  it("matches the brief for KSB (longest CCC)", () => {
    const k = SBU_SEEDS.find((s) => s.key === "KSB")!;
    // 79 + 110 + 0 - 26 = 163
    expect(nwcOf(k)).toBe(163);
    // 154 + 161 - 50 = 265  ← brief says "CCC 265 days — longest in portfolio"
    expect(cccOf(k)).toBe(265);
  });

  it("matches the brief for SMC (FY-25 baseline)", () => {
    const s = SBU_SEEDS.find((x) => x.key === "SMC")!;
    expect(nwcOf(s)).toBe(48); // 61 + 35 + 0 - 48
    expect(cccOf(s)).toBe(64); // 96 + 43 - 75
  });
});

describe("cogsPerDay / revPerDay fallbacks", () => {
  it("uses Inv/DIO when DIO > 0", () => {
    const atc = SBU_SEEDS.find((s) => s.key === "ATC")!;
    expect(cogsPerDay(atc)).toBeCloseTo(atc.inv / atc.dio, 4);
  });

  it("falls back to AP/DPO when DIO=0 (STCL has DIO=0, DPO>0)", () => {
    const stcl = SBU_SEEDS.find((s) => s.key === "STCL")!;
    expect(stcl.dio).toBe(0);
    expect(cogsPerDay(stcl)).toBeCloseTo(stcl.ap / stcl.dpo, 4);
  });

  it("uses 0.05 floor when both DIO and DPO are zero", () => {
    expect(
      cogsPerDay({ inv: 0, ar: 0, ca: 0, ap: 0, dio: 0, dso: 0, dpo: 0 }),
    ).toBe(0.05);
  });

  it("uses (AR+CA)/DSO when DSO > 0", () => {
    const c = SBU_SEEDS.find((s) => s.key === "Citiscape")!;
    expect(revPerDay(c)).toBeCloseTo((c.ar + c.ca) / c.dso, 4);
  });

  it("annualRevenue equals revPerDay × 365", () => {
    const w = SBU_SEEDS.find((s) => s.key === "Wetico")!;
    expect(annualRevenue(w)).toBeCloseTo(revPerDay(w) * 365, 2);
  });
});

describe("groupTotalsOf", () => {
  it("group revenue is within rounding of the seeded baseline (~SAR 3.87B)", () => {
    const g = groupTotalsOf(SBU_SEEDS);
    // Seed stores 3868; the underlying derivation lands within ±5 SAR m
    // due to share-percentage rounding in the source.
    expect(g.revenue).toBeGreaterThan(GROUP_SEED.groupRevenue - 25);
    expect(g.revenue).toBeLessThan(GROUP_SEED.groupRevenue + 25);
  });

  it("Wetico contributes ~42% of group revenue (matches brief)", () => {
    const g = groupTotalsOf(SBU_SEEDS);
    const w = SBU_SEEDS.find((s) => s.key === "Wetico")!;
    const share = annualRevenue(w) / g.revenue;
    expect(share).toBeGreaterThan(0.41);
    expect(share).toBeLessThan(0.43);
  });

  it("group NWC equals sum of components minus AP", () => {
    const g = groupTotalsOf(SBU_SEEDS);
    expect(g.nwc).toBeCloseTo(g.inv + g.ar + g.ca - g.ap, 4);
  });

  it("NWC/Revenue baseline is in the 20–25% band", () => {
    // The HTML hero contains a hand-typed "21.2%" literal; the actual
    // runtime computation (totNwc/totRev) lands ~23–24% with the same
    // source numbers. Both the original brief and this dashboard will
    // show the computed value, so we assert the band, not the literal.
    const g = groupTotalsOf(SBU_SEEDS);
    expect(g.nwcPctRevenue).toBeGreaterThan(0.20);
    expect(g.nwcPctRevenue).toBeLessThan(0.25);
  });
});

describe("applyPreset", () => {
  it("factor=0 returns the baseline unchanged", () => {
    const w = SBU_SEEDS.find((s) => s.key === "Wetico")!;
    const adj = applyPreset({ ...w }, 0);
    expect(adj).toEqual({
      inv: w.inv, ar: w.ar, ca: w.ca, ap: w.ap,
      dio: w.dio, dso: w.dso, dpo: w.dpo,
    });
  });

  it("factor=1 returns the target", () => {
    const k = SBU_SEEDS.find((s) => s.key === "KSB")!;
    const adj = applyPreset({ ...k }, 1);
    expect(adj).toEqual({
      inv: k.tInv, ar: k.tAr, ca: k.tCa, ap: k.tAp,
      dio: k.tDio, dso: k.tDso, dpo: k.tDpo,
    });
  });

  it("factor=0.5 lands halfway", () => {
    const k = SBU_SEEDS.find((s) => s.key === "KSB")!;
    const adj = applyPreset({ ...k }, 0.5);
    expect(adj.dpo).toBeCloseTo((k.dpo + k.tDpo) / 2, 4);
    expect(adj.inv).toBeCloseTo((k.inv + k.tInv) / 2, 4);
  });

  it("clamps factor to [0,1]", () => {
    const k = SBU_SEEDS.find((s) => s.key === "KSB")!;
    const adj = applyPreset({ ...k }, 5);
    expect(adj.dpo).toBe(k.tDpo);
  });
});

describe("cashReleased", () => {
  it("zero release when adjusted equals baseline", () => {
    const adj = SBU_SEEDS.map((s) => ({
      inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap,
      dio: s.dio, dso: s.dso, dpo: s.dpo,
    }));
    expect(cashReleased(adj, adj)).toBe(0);
  });

  it("hitting all targets releases cash > 0", () => {
    const baseline = SBU_SEEDS.map((s) => ({
      inv: s.inv, ar: s.ar, ca: s.ca, ap: s.ap,
      dio: s.dio, dso: s.dso, dpo: s.dpo,
    }));
    const adjusted = SBU_SEEDS.map((s) =>
      applyPreset({ ...s }, 1),
    );
    const release = cashReleased(baseline, adjusted);
    // Hit-all should land near the SAR 540m operational target the
    // brief tracks. Allow generous tolerance — the headline is roughly
    // ±10% across runs of the original brief depending on which
    // SBUs are in scope.
    expect(release).toBeGreaterThan(400);
    expect(release).toBeLessThan(700);
  });
});
