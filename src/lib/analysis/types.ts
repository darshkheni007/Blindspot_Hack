import { z } from "zod";

export const CATEGORIES = ["ASSUMPTION", "CONSTRAINT", "QUESTION", "CONTRADICTION", "DATA_ISSUE"] as const;
export const CONFIDENCES = ["EVIDENCE_BACKED", "INFERRED", "PATTERN_BASED"] as const;

const factor = z.number().int().min(1).max(5);

export const EvidenceSchema = z.object({
  documentId: z.string().optional(),
  documentName: z.string().min(1),
  locator: z.string().min(1),
  quote: z.string().min(3).max(1200),
  /** Optional short label, e.g. "States go-live" or "Conflicting date". */
  note: z.string().max(200).optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const RawFindingSchema = z
  .object({
    detector: z.string(),
    category: z.enum(CATEGORIES),
    title: z.string().min(12).max(220),
    whyItMatters: z.string().min(20).max(900),
    evidence: z.array(EvidenceSchema).max(6),
    isAbsence: z.boolean().default(false),
    /** Documents that were searched when claiming something is absent. */
    checkedDocuments: z.array(z.string()).default([]),
    /** Terms whose presence anywhere in the corpus would refute an absence claim (checked by the verifier). */
    absenceTerms: z.array(z.string()).default([]),
    confidence: z.enum(CONFIDENCES),
    factors: z.object({ impact: factor, likelihood: factor, irreversibility: factor, proximity: factor, cost: factor }),
    justifications: z.object({
      impact: z.string().min(3).max(240),
      likelihood: z.string().min(3).max(240),
      irreversibility: z.string().min(3).max(240),
      proximity: z.string().min(3).max(240),
      cost: z.string().min(3).max(240),
    }),
    disproof: z.string().min(10).max(500),
    question: z.string().min(10).max(400),
    owner: z.string().min(2).max(80),
    nextStep: z.string().min(10).max(400),
    /** Findings sharing a groupKey are presented as one root cause. */
    groupKey: z.string().max(80).optional(),
    /** Stable identity for diffing across runs (e.g. "checklist:rollback"). */
    key: z.string().min(2).max(160),
  })
  .refine((f) => f.evidence.length > 0 || (f.isAbsence && f.checkedDocuments.length > 0), {
    message: "A finding needs evidence pointers (quotes or, for absences, the documents checked).",
  });
export type RawFinding = z.infer<typeof RawFindingSchema>;

export const AssumptionCandidateSchema = z.object({
  statement: z.string().min(10).max(300),
  sourceDoc: z.string(),
  sourceLocator: z.string(),
  sourceQuote: z.string().min(3).max(600),
  riskIfFalse: z.string().min(10).max(400),
  key: z.string(),
});
export type AssumptionCandidate = z.infer<typeof AssumptionCandidateSchema>;

export const QuestionCandidateSchema = z.object({
  text: z.string().min(10).max(400),
  suggestedOwner: z.string().min(2).max(80),
  findingKey: z.string().optional(),
  key: z.string(),
});
export type QuestionCandidate = z.infer<typeof QuestionCandidateSchema>;

/** What a provider returns for detector tasks. Items are validated one by one so a single malformed item never discards the batch. */
export const LooseOutputSchema = z.object({
  findings: z.array(z.unknown()).default([]),
  assumptions: z.array(z.unknown()).default([]),
  questions: z.array(z.unknown()).default([]),
});
export type LooseOutput = z.infer<typeof LooseOutputSchema>;

export function validateItems<T>(items: unknown[], schema: z.ZodType<T>): { valid: T[]; dropped: number } {
  const valid: T[] = [];
  let dropped = 0;
  for (const it of items) {
    const r = schema.safeParse(it);
    if (r.success) valid.push(r.data);
    else dropped++;
  }
  return { valid, dropped };
}

export const VerdictSchema = z.object({
  verdict: z.enum(["supported", "weak", "refuted"]),
  reason: z.string().max(400),
});
export type Verdict = z.infer<typeof VerdictSchema>;

// ---- inputs shared by detectors/providers ----
export interface ProjectInfo {
  id: string;
  name: string;
  domain: string;
  stage: string;
  goal: string;
  deadline: string | null;
  budget: string | null;
  teamSize: number | null;
  knownRisks: string | null;
}
export interface DocInfo {
  id: string;
  name: string;
  docType: string;
  contentHash: string;
}
export interface ChunkInfo {
  documentId: string;
  documentName: string;
  ordinal: number;
  locator: string;
  text: string;
}
export interface ChecklistItem {
  id: string;
  label: string;
  /** Root-cause group shown in the UI ("launch-readiness", "compliance", ...). */
  group: string;
  /** Things in the documents that make this item relevant ("cutover", "go-live"). Empty = always relevant. */
  anchors: string[];
  /** If any of these appear anywhere, the topic counts as addressed. */
  keywords: string[];
  /** May contain {anchor}. */
  title: string;
  why: string;
  question: string;
  owner: string;
  nextStep: string;
  disproof: string;
  category: (typeof CATEGORIES)[number];
  factors: { impact: number; likelihood: number; irreversibility: number; proximity: number; cost: number };
  /** Likelihood and proximity justifications are generated from the project context. */
  justifications: { impact: string; irreversibility: string; cost: string };
}
