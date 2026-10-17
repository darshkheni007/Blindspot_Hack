import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, FACTORS, priorityScore, sanitizeWeights, severityFor, type Factors } from "@/lib/analysis/scoring";

const f = (o: Partial<Factors> = {}): Factors => ({ impact: 3, likelihood: 3, irreversibility: 3, proximity: 3, cost: 3, ...o });

describe("priorityScore", () => {
  it("maps the extremes to 100 and 0", () => {
    expect(priorityScore({ impact: 5, likelihood: 5, irreversibility: 5, proximity: 5, cost: 1 })).toBe(100);
    expect(priorityScore({ impact: 1, likelihood: 1, irreversibility: 1, proximity: 1, cost: 5 })).toBe(0);
  });
  it("increases with each benefit factor and decreases with cost", () => {
    for (const k of ["impact", "likelihood", "irreversibility", "proximity"] as const) {
      expect(priorityScore(f({ [k]: 5 }))).toBeGreaterThan(priorityScore(f({ [k]: 2 })));
    }
    expect(priorityScore(f({ cost: 1 }))).toBeGreaterThan(priorityScore(f({ cost: 5 })));
  });
  it("is deterministic and stays within 0-100 for every input and weight", () => {
    const ws = [DEFAULT_WEIGHTS, { ...DEFAULT_WEIGHTS, impact: 2, cost: 0 }, { impact: 0, likelihood: 0, irreversibility: 0, proximity: 0, cost: 0 }, { impact: 2, likelihood: 2, irreversibility: 2, proximity: 2, cost: 2 }];
    for (const w of ws) {
      for (let a = 1; a <= 5; a++) for (let c = 1; c <= 5; c++) {
        const s = priorityScore(f({ impact: a, cost: c }), w);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
        expect(priorityScore(f({ impact: a, cost: c }), w)).toBe(s);
      }
    }
  });
  it("re-ranks when weights change", () => {
    const highImpact = f({ impact: 5, proximity: 1 });
    const soon = f({ impact: 1, proximity: 5 });
    const impactHeavy = { ...DEFAULT_WEIGHTS, impact: 2, proximity: 0 };
    const proximityHeavy = { ...DEFAULT_WEIGHTS, impact: 0, proximity: 2 };
    expect(priorityScore(highImpact, impactHeavy)).toBeGreaterThan(priorityScore(soon, impactHeavy));
    expect(priorityScore(soon, proximityHeavy)).toBeGreaterThan(priorityScore(highImpact, proximityHeavy));
  });
  it("clamps out-of-range factors", () => {
    expect(priorityScore(f({ impact: 99 }))).toBe(priorityScore(f({ impact: 5 })));
    expect(priorityScore(f({ cost: -4 }))).toBe(priorityScore(f({ cost: 1 })));
  });
});

describe("severityFor", () => {
  it("uses the documented thresholds", () => {
    expect(severityFor(100)).toBe("CRITICAL");
    expect(severityFor(85)).toBe("CRITICAL");
    expect(severityFor(84)).toBe("HIGH");
    expect(severityFor(72)).toBe("HIGH");
    expect(severityFor(71)).toBe("MEDIUM");
    expect(severityFor(55)).toBe("MEDIUM");
    expect(severityFor(54)).toBe("LOW");
    expect(severityFor(0)).toBe("LOW");
  });
});

describe("sanitizeWeights", () => {
  it("fills defaults, clamps and ignores junk", () => {
    expect(sanitizeWeights(null)).toEqual(DEFAULT_WEIGHTS);
    const w = sanitizeWeights({ impact: 9, likelihood: -3, cost: "abc" });
    expect(w.impact).toBe(2);
    expect(w.likelihood).toBe(0);
    expect(w.cost).toBe(1);
    expect(Object.keys(w).sort()).toEqual([...FACTORS].sort());
  });
});
