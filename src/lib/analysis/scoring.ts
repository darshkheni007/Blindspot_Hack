/**
 * Priority scoring — a pure function (unit tested in tests/scoring.test.ts).
 *
 *   raw = Impact^wI × Likelihood^wL × Irreversibility^wR × Proximity^wP / Cost^wC
 *
 * Every factor is an integer 1–5. With default weights (all 1) raw ranges from 1/5 to 625. The raw
 * value is mapped to 0–100 on a log scale between the minimum and maximum reachable for the given
 * weights, so re-weighting never pushes scores outside 0–100.
 */
export const FACTORS = ["impact", "likelihood", "irreversibility", "proximity", "cost"] as const;
export type Factor = (typeof FACTORS)[number];
export type Factors = Record<Factor, number>;
export type Weights = Record<Factor, number>;

export const DEFAULT_WEIGHTS: Weights = { impact: 1, likelihood: 1, irreversibility: 1, proximity: 1, cost: 1 };
export const WEIGHT_RANGE = { min: 0, max: 2, step: 0.25 } as const;

export const FACTOR_LABELS: Record<Factor, { label: string; help: string }> = {
  impact: { label: "Impact", help: "How much damage if this turns out to be a real gap (5 = project fails)." },
  likelihood: { label: "Likelihood", help: "How likely the gap is real and will bite (5 = almost certain)." },
  irreversibility: { label: "Irreversibility", help: "How hard it is to undo once it happens (5 = cannot be undone)." },
  proximity: { label: "Proximity", help: "How soon it will bite (5 = within weeks, 1 = far off)." },
  cost: { label: "Cost to resolve", help: "Effort to close the gap now (1 = one conversation, 5 = major rework). Lower cost raises priority." },
};

export function clampFactor(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function sanitizeWeights(w: Partial<Record<Factor, unknown>> | null | undefined): Weights {
  const out = { ...DEFAULT_WEIGHTS };
  if (!w) return out;
  for (const f of FACTORS) {
    const v = Number(w[f]);
    if (Number.isFinite(v)) out[f] = Math.min(WEIGHT_RANGE.max, Math.max(WEIGHT_RANGE.min, v));
  }
  return out;
}

export function rawScore(f: Factors, w: Weights = DEFAULT_WEIGHTS): number {
  return (
    Math.pow(clampFactor(f.impact), w.impact) *
    Math.pow(clampFactor(f.likelihood), w.likelihood) *
    Math.pow(clampFactor(f.irreversibility), w.irreversibility) *
    Math.pow(clampFactor(f.proximity), w.proximity) /
    Math.pow(clampFactor(f.cost), w.cost)
  );
}

export function priorityScore(f: Factors, w: Weights = DEFAULT_WEIGHTS): number {
  const lnMax = Math.log(5) * (w.impact + w.likelihood + w.irreversibility + w.proximity);
  const lnMin = -Math.log(5) * w.cost;
  if (lnMax - lnMin < 1e-9) return 50;
  const score = ((Math.log(rawScore(f, w)) - lnMin) / (lnMax - lnMin)) * 100;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export type SeverityKey = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export function severityFor(score: number): SeverityKey {
  if (score >= 85) return "CRITICAL";
  if (score >= 72) return "HIGH";
  if (score >= 55) return "MEDIUM";
  return "LOW";
}
export const SEVERITY_ORDER: SeverityKey[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
