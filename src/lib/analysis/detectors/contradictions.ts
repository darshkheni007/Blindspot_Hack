import { loadPrompt } from "../prompts";
import { corpusPayload, proximityFor, type DetectorContext } from "../context";
import { extractFacts, fmtValue, type Fact } from "../facts";
import { LooseOutputSchema, RawFindingSchema, validateItems, type ChunkInfo, type ProjectInfo, type RawFinding } from "../types";
import { cap, ev, fmtDay, finding, trunc } from "./helpers";

export interface CorpusInput {
  project: ProjectInfo;
  documents: Array<{ name: string; type: string }>;
  chunks: ChunkInfo[];
}

const HISTORIC = /\b(previously|originally|formerly|last (?:year|quarter)|was planned|used to)\b/i;

/** impact, likelihood, irreversibility, proximity(default), cost per label */
const FACTORS: Record<string, [number, number, number, number, number]> = {
  "go-live date": [5, 5, 3, 4, 1],
  deadline: [5, 4, 3, 4, 1],
  "project start": [3, 4, 2, 3, 1],
  "legacy shutdown": [4, 4, 4, 4, 1],
  "approved budget": [4, 5, 3, 3, 1],
  "estimated total": [4, 4, 3, 3, 1],
  contingency: [3, 4, 2, 3, 1],
  "team size": [4, 4, 2, 3, 2],
  "concurrent users": [4, 4, 3, 3, 2],
  UAT: [3, 4, 2, 3, 1],
  "code freeze": [3, 4, 2, 3, 1],
};

function differs(a: Fact, b: Fact): boolean {
  if (a.kind === "money") return Math.abs(a.value - b.value) / Math.max(a.value, b.value) > 0.02;
  return a.value !== b.value;
}

function pickPair(group: Fact[]): [Fact, Fact] | null {
  const sameDoc: [Fact, Fact][] = [];
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j];
      if (!differs(a, b)) continue;
      if (a.chunk.documentId !== b.chunk.documentId) return [a, b];
      if (a.chunk.locator !== b.chunk.locator) sameDoc.push([a, b]);
    }
  }
  return sameDoc[0] ?? null;
}

const GROUP_BY_KIND = { date: "schedule", money: "budget", count: "capacity" } as const;

/** Rule-based stand-in for the LLM: compares labelled dates, amounts and counts across the corpus. */
export function localContradictions(input: CorpusInput, ctx: Pick<DetectorContext, "project" | "now">): RawFinding[] {
  const facts = extractFacts(input.chunks).filter((f) => !HISTORIC.test(f.sentence));
  const groups = new Map<string, Fact[]>();
  for (const f of facts) {
    if (f.kind === "count" && !["team size", "concurrent users"].includes(f.label)) continue;
    if (f.kind === "money" && f.label === "estimated total") continue; // handled by quantitative checks
    const k = `${f.kind}|${f.label}|${f.unit ?? ""}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(f);
  }
  const out: RawFinding[] = [];
  for (const [k, group] of groups) {
    const pair = pickPair(group);
    if (!pair) continue;
    const [a, b] = pair;
    const [kind, label] = k.split("|") as [Fact["kind"], string];
    const t = FACTORS[label] ?? [3, 4, 2, 3, 2];
    const sameDoc = a.chunk.documentId === b.chunk.documentId;
    const where = (f: Fact) => (sameDoc ? `${f.chunk.documentName} (${f.chunk.locator})` : f.chunk.documentName);
    const show = (f: Fact) => (f.kind === "date" ? fmtDay(f.value) : fmtValue(f));
    const va = show(a), vb = show(b);
    let why: string;
    let prox = proximityFor(ctx);
    if (kind === "date") {
      const gap = Math.abs(a.value - b.value);
      prox = proximityFor(ctx, Math.min(a.value, b.value));
      why = `Teams will plan and staff against whichever date they saw. The two sources are ${gap} day${gap === 1 ? "" : "s"} apart, which is enough to break dependent milestones, contracts and communications.`;
    } else if (kind === "money") {
      const delta = Math.abs(a.value - b.value);
      why = `Decisions about spending and scope depend on which figure is right. The two amounts differ by ${Math.round(delta).toLocaleString("en")} (${Math.round((delta / Math.max(a.value, b.value)) * 100)}%).`;
    } else {
      why = `Capacity, staffing and test plans built on different numbers will not agree. One side is working from ${Math.min(a.value, b.value)}, the other from ${Math.max(a.value, b.value)}.`;
    }
    out.push(
      finding({
        detector: "contradictions",
        key: `contradiction:${kind}:${label.replace(/\W+/g, "-")}`,
        category: "CONTRADICTION",
        title: sameDoc
          ? `${cap(label)} is stated as ${va} in one place and ${vb} in another within ${a.chunk.documentName}`
          : `${cap(label)} is ${va} in ${a.chunk.documentName} but ${vb} in ${b.chunk.documentName}`,
        whyItMatters: why,
        evidence: [
          ev(a.chunk.documentName, a.chunk.locator, a.sentence, `States ${label} as ${va}`),
          ev(b.chunk.documentName, b.chunk.locator, b.sentence, `States ${label} as ${vb}`),
        ],
        confidence: kind === "count" ? "INFERRED" : "EVIDENCE_BACKED",
        factors: { impact: t[0], likelihood: t[1], irreversibility: t[2], proximity: Math.max(t[3] - 1, prox.value), cost: t[4] },
        justifications: {
          impact: `${trunc(where(a), 40)} and ${trunc(where(b), 40)} are both likely to be used for decisions`,
          likelihood: "Both statements are quoted directly from the documents",
          irreversibility: kind === "date" ? "Commitments made to the wrong date are hard to unwind" : "Money or capacity committed on the wrong figure is hard to recover",
          proximity: prox.reason,
          cost: "One conversation with the owner settles which value is right",
        },
        disproof: `Evidence that the two values describe different things (for example different phases or scopes), or that one has been formally superseded.`,
        question: `Which ${label} is correct: ${va} (${where(a)}) or ${vb} (${where(b)}) — and which document is the source of truth?`,
        owner: kind === "money" ? "Finance partner / Project sponsor" : kind === "date" ? "Project manager" : "Delivery manager",
        nextStep: `Agree one value for ${label}, update both documents, and record who owns changes to it.`,
        groupKey: GROUP_BY_KIND[kind],
      }),
    );
  }
  return out;
}

export async function runContradictions(ctx: DetectorContext) {
  const p = corpusPayload(ctx);
  const out = await ctx.provider.generate({
    task: "contradictions",
    system: loadPrompt("system") + "\n\n" + loadPrompt("schema"),
    prompt: loadPrompt("contradictions"),
    input: p,
    schema: LooseOutputSchema,
  });
  const f = validateItems(out.findings, RawFindingSchema);
  return { findings: f.valid, dropped: f.dropped };
}
