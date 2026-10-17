import { describe, expect, it } from "vitest";
import { dedupe } from "@/lib/analysis/dedupe";
import { finding } from "@/lib/analysis/detectors/helpers";
import { extractFacts } from "@/lib/analysis/facts";
import { MockProvider } from "@/lib/analysis/providers/mock";
import { projectVocabulary, specificityCheck } from "@/lib/analysis/specificity";
import type { ChunkInfo, RawFinding } from "@/lib/analysis/types";
import { verifyFinding } from "@/lib/analysis/verifier";

const chunk = (documentName: string, locator: string, text: string, ordinal = 0): ChunkInfo => ({ documentId: documentName, documentName, locator, text, ordinal });
const corpus: ChunkInfo[] = [
  chunk("PRD.md", "lines 1-2", "Go-live is 15 March 2027. The delivery team is a team of 6 engineers."),
  chunk("Plan.md", "line 8", "Cutover weekend and go-live: 30 April 2027"),
];
const base = (over: Partial<RawFinding> = {}): RawFinding =>
  finding({
    detector: "test",
    category: "CONTRADICTION",
    title: "Go-live is 15 Mar 2027 in PRD.md but 30 Apr 2027 in Plan.md",
    whyItMatters: "Teams will plan against whichever date they saw, which breaks milestones.",
    evidence: [{ documentName: "PRD.md", locator: "lines 1-2", quote: "Go-live is 15 March 2027." }],
    confidence: "EVIDENCE_BACKED",
    factors: { impact: 4, likelihood: 4, irreversibility: 3, proximity: 4, cost: 2 },
    justifications: { impact: "a", likelihood: "b", irreversibility: "c", proximity: "d", cost: "e" },
    disproof: "A change note that moves one of the dates.",
    question: "Which go-live date is real?",
    owner: "Project sponsor",
    nextStep: "Confirm and update both documents.",
    ...over,
  } as never);

describe("facts", () => {
  it("extracts labelled dates and counts, and the two go-live dates differ", () => {
    const facts = extractFacts(corpus);
    const dates = facts.filter((f) => f.kind === "date" && /go-live/i.test(f.label));
    expect(dates.length).toBeGreaterThanOrEqual(2);
    expect(new Set(dates.map((d) => d.value)).size).toBe(2);
    expect(facts.some((f) => f.kind === "count" && f.value === 6)).toBe(true);
  });
});

describe("specificity check", () => {
  const vocab = projectVocabulary(corpus);
  it("keeps findings tied to the project's own wording", () => {
    expect(specificityCheck(base(), vocab).ok).toBe(true);
  });
  it("discards boilerplate", () => {
    const r = specificityCheck(base({ title: "Consider security best practices for the project", evidence: [] }), vocab);
    expect(r.ok).toBe(false);
  });
  it("discards generic findings with no project-specific terms", () => {
    const r = specificityCheck(base({ title: "Ensure the team communicates regularly and often", evidence: [{ documentName: "PRD.md", locator: "x", quote: "is a team" }] }), vocab);
    expect(r.ok).toBe(false);
  });
});

describe("verifier", () => {
  const provider = new MockProvider();
  it("keeps a finding whose quote is verbatim in the cited document", async () => {
    const r = await verifyFinding(base(), corpus, provider);
    expect(r.keep).toBe(true);
    expect(r.finding.evidence).toHaveLength(1);
  });
  it("rejects a finding whose quotes are invented", async () => {
    const r = await verifyFinding(base({ evidence: [{ documentName: "PRD.md", locator: "x", quote: "Go-live is 1 January 2030." }] }), corpus, provider);
    expect(r.keep).toBe(false);
  });
  it("rejects a finding with no evidence at all", async () => {
    expect((await verifyFinding(base({ evidence: [] }), corpus, provider)).keep).toBe(false);
  });
  it("refutes an absence claim when the topic is in the documents", async () => {
    const withRollback = [...corpus, chunk("Plan.md", "line 20", "The rollback procedure restores the legacy system within four hours.")];
    const claim = base({ isAbsence: true, category: "CONSTRAINT", evidence: [], absenceTerms: ["rollback"], checkedDocuments: ["PRD.md", "Plan.md"] });
    expect((await verifyFinding(claim, withRollback, provider)).keep).toBe(false);
    expect((await verifyFinding(claim, corpus, provider)).keep).toBe(true);
  });
  it("is not fooled by negated mentions", async () => {
    const negated = [...corpus, chunk("Plan.md", "line 9", "Customers will adopt the portal without additional training.")];
    const claim = base({ isAbsence: true, category: "CONSTRAINT", evidence: [], absenceTerms: ["training"], checkedDocuments: ["Plan.md"] });
    expect((await verifyFinding(claim, negated, provider)).keep).toBe(true);
  });
});

describe("dedupe", () => {
  it("merges identical keys and near-identical titles, keeping the higher priority", () => {
    const { kept, merged } = dedupe([
      { key: "a", title: "No rollback plan is described for the cutover weekend", category: "CONSTRAINT", priority: 70 },
      { key: "b", title: "No rollback plan is described for the cutover", category: "CONSTRAINT", priority: 80 },
      { key: "c", title: "Budget total does not match its lines", category: "DATA_ISSUE", priority: 60 },
      { key: "c", title: "Budget total does not match its lines", category: "DATA_ISSUE", priority: 50 },
    ]);
    expect(kept.map((k) => k.key).sort()).toEqual(["b", "c"]);
    expect(merged).toHaveLength(2);
  });
});
