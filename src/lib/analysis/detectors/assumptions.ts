import { loadPrompt } from "../prompts";
import { shortHash, normalize } from "../text";
import {
  AssumptionCandidateSchema,
  LooseOutputSchema,
  RawFindingSchema,
  validateItems,
  type AssumptionCandidate,
  type ProjectInfo,
  type RawFinding,
} from "../types";
import { PROMPT_VERSION } from "../prompts";
import type { DetectorContext } from "../context";
import { proximityFor } from "../context";
import { cap, ev, finding, trunc } from "./helpers";

export interface AssumptionsInput {
  project: ProjectInfo;
  document: { name: string; docType: string };
  chunks: Array<{ locator: string; text: string }>;
}

const MARKERS: Array<{ re: RegExp; w: number }> = [
  { re: /\bassum(?:e|es|ed|ing|ption|ptions)\b/i, w: 5 },
  { re: /\b(?:will|would) (?:remain|continue to|stay|keep)\b/i, w: 4 },
  { re: /\b(?:no|zero) (?:impact|changes?|downtime|issues?|risk|dependencies|need)\b/i, w: 4 },
  { re: /\b(?:should|will) (?:be )?(?:able to|straightforward|trivial|simple|easy|fine)\b/i, w: 3 },
  { re: /\b(?:is|are) (?:expected|planned|assumed|likely) to\b/i, w: 3 },
  { re: /\bwe (?:believe|expect|anticipate|trust|think)\b/i, w: 3 },
  { re: /\b(?:already|currently) (?:in place|available|agreed|approved|supported|compatible)\b/i, w: 3 },
  { re: /\b(?:vendor|supplier|provider|partner|client|third[- ]party|contractor)\b[^.]{0,50}\b(?:will|to) (?:deliver|provide|confirm|approve|supply|be ready|complete|handle)\b/i, w: 4 },
  { re: /\b(?:because|since) (?:it is|it's|this is) (?:straightforward|simple|easy|trivial|obvious)|without (?:additional|any|extra|further) \w+/i, w: 4 },
  { re: /\bwill (?:adopt|accept|migrate|switch|follow|agree)\b/i, w: 3 },
  { re: /\b(?:same as|unchanged|as before|as-is|carry over|reused?)\b/i, w: 2 },
];

const CLASSES: Array<{ id: string; re: RegExp; risk: string; owner: string; f: [number, number, number, number, number] }> = [
  { id: "vendor", re: /vendor|supplier|partner|third[- ]party|contractor|client/i, risk: "If the other party does not deliver or confirm as assumed, everything that depends on it waits and the schedule moves with it.", owner: "Vendor / Procurement manager", f: [4, 3, 3, 4, 2] },
  { id: "cost", re: /budget|cost|price|funding|spend/i, risk: "If the cost assumption is wrong, the shortfall surfaces mid-project when options are limited.", owner: "Finance partner", f: [4, 3, 3, 3, 1] },
  { id: "schedule", re: /on time|deadline|\bweeks?\b|\bmonths?\b|\bdays?\b|by (?:the )?end|schedule|sprint/i, risk: "If the timing assumption is wrong, dependent milestones slip and fixed dates are missed.", owner: "Project manager", f: [4, 4, 3, 4, 2] },
  { id: "data", re: /\bdata\b|records?|migrat|database|tables?/i, risk: "If the data is not as clean, complete or compatible as assumed, the work needs rework and can corrupt downstream reports.", owner: "Data owner", f: [5, 3, 4, 3, 2] },
  { id: "tech", re: /\bapi\b|legacy|system|integration|server|performance|infrastructure|platform|service/i, risk: "If the system behaves differently from what is assumed, dependent work has to be redesigned late.", owner: "Engineering lead", f: [4, 3, 3, 3, 2] },
  { id: "people", re: /team|staff|users?|training|adopt|resources?|availab/i, risk: "If people are not available or do not adopt the change as assumed, delivery slows or the benefit is never realised.", owner: "Product / Delivery manager", f: [3, 3, 2, 3, 2] },
];

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, ""))
    .filter((s) => s.length >= 30 && !s.startsWith("#") && !s.endsWith("?") && !s.startsWith("Columns:"));
}

/** Rule-based stand-in for the LLM: scans sentences for assumption language. Deterministic. */
export function localAssumptions(input: AssumptionsInput, ctx?: Pick<DetectorContext, "project" | "now">) {
  const scored: Array<{ s: string; locator: string; w: number; order: number }> = [];
  let order = 0;
  for (const c of input.chunks) {
    for (const s of sentences(c.text)) {
      const w = MARKERS.reduce((sum, m) => sum + (m.re.test(s) ? m.w : 0), 0);
      if (w >= 3) scored.push({ s, locator: c.locator, w, order: order++ });
    }
  }
  scored.sort((a, b) => b.w - a.w || a.order - b.order);
  const top = scored.slice(0, 8).sort((a, b) => a.order - b.order);
  const assumptions: AssumptionCandidate[] = [];
  const findings: RawFinding[] = [];
  const seen = new Set<string>();
  for (const t of top) {
    const key = `assumption:${shortHash(normalize(t.s))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cls = CLASSES.find((c) => c.re.test(t.s));
    const risk = cls?.risk ?? "If this turns out not to hold, the parts of the plan that rely on it need rework.";
    assumptions.push({
      statement: trunc(t.s, 280),
      sourceDoc: input.document.name,
      sourceLocator: t.locator,
      sourceQuote: trunc(t.s, 580),
      riskIfFalse: risk,
      key,
    });
    if (cls && t.w >= 4 && findings.length < 3) {
      const prox = proximityFor(ctx ?? { project: input.project as never, now: new Date() });
      findings.push(
        finding({
          detector: "assumptions",
          key,
          category: "ASSUMPTION",
          title: `Assumed without evidence: “${trunc(t.s, 110)}”`,
          whyItMatters: `${risk} ${input.document.name} (${t.locator}) states this as fact, and nothing in the same passage says how it will be confirmed.`,
          evidence: [ev(input.document.name, t.locator, t.s, "Stated as fact")],
          confidence: "INFERRED",
          factors: { impact: cls.f[0], likelihood: cls.f[1], irreversibility: cls.f[2], proximity: Math.max(cls.f[3], prox.value - 1), cost: cls.f[4] },
          justifications: {
            impact: `Work in ${input.document.name} is sequenced on the assumption holding`,
            likelihood: "Stated as certain with no test, owner or fallback in the passage",
            irreversibility: `Rework after the ${cls.id} assumption fails is costlier than checking it now`,
            proximity: prox.reason,
            cost: "Usually one conversation or one test to confirm",
          },
          disproof: "Written confirmation, a test result or an owner sign-off showing the statement holds.",
          question: `What evidence confirms that “${trunc(t.s, 90)}”, and what is the plan if it does not hold?`,
          owner: cls.owner,
          nextStep: `Ask the owner for evidence of this statement and record the answer next to it in ${input.document.name}.`,
          groupKey: `assumptions-${cls.id}`,
        }),
      );
    }
  }
  return { assumptions, findings };
}

export async function runAssumptions(ctx: DetectorContext, doc: { id: string; name: string; docType: string }) {
  const chunks = ctx.chunks.filter((c) => c.documentId === doc.id).map((c) => ({ locator: c.locator, text: c.text }));
  if (chunks.length === 0) return { assumptions: [], findings: [], dropped: 0 };
  const input: AssumptionsInput = { project: ctx.project, document: { name: doc.name, docType: doc.docType }, chunks };
  const out = await ctx.provider.generate({
    task: "assumptions",
    system: loadPrompt("system") + "\n\n" + loadPrompt("schema"),
    prompt: loadPrompt("assumptions"),
    input,
    schema: LooseOutputSchema,
  });
  const a = validateItems(out.assumptions, AssumptionCandidateSchema);
  const f = validateItems(out.findings, RawFindingSchema);
  void cap;
  return { assumptions: a.valid, findings: f.valid, dropped: a.dropped + f.dropped, promptVersion: PROMPT_VERSION };
}
