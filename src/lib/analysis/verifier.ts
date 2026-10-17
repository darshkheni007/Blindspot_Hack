import { loadPrompt } from "./prompts";
import { hasAnyTerm, normalize, corpusText } from "./text";
import { VerdictSchema, type ChunkInfo, type RawFinding } from "./types";
import type { LLMProvider } from "./providers/types";
import { ProviderUnavailableError } from "./providers/types";

export interface VerifyOutcome {
  keep: boolean;
  finding: RawFinding;
  detail: { programmatic: string[]; llm: string; reason: string };
}

const DOWNGRADE: Record<RawFinding["confidence"], RawFinding["confidence"]> = {
  EVIDENCE_BACKED: "INFERRED",
  INFERRED: "PATTERN_BASED",
  PATTERN_BASED: "PATTERN_BASED",
};

/**
 * Verifier pass. Two layers:
 *  1. programmatic, provider-independent: every quote must exist verbatim in the cited document, and an
 *     absence claim is refuted if any of its terms appears anywhere in the corpus;
 *  2. a refutation attempt by the provider against the full corpus.
 * Findings without surviving evidence pointers are dropped.
 */
export async function verifyFinding(f: RawFinding, chunks: ChunkInfo[], provider: LLMProvider): Promise<VerifyOutcome> {
  const notes: string[] = [];
  const names = new Set(chunks.map((c) => c.documentName));
  const evidence = f.evidence.filter((e) => {
    const q = normalize(e.quote);
    const ok = chunks.some((c) => c.documentName === e.documentName && normalize(c.text).includes(q));
    if (!ok) notes.push(`quote not found in ${e.documentName} ${e.locator}`);
    return ok;
  });
  let current: RawFinding = { ...f, evidence, checkedDocuments: f.checkedDocuments.filter((d) => names.has(d)) };

  if (current.isAbsence) {
    const hit = hasAnyTerm(corpusText(chunks), current.absenceTerms);
    if (hit) return { keep: false, finding: current, detail: { programmatic: [...notes, `absence refuted: “${hit}” appears in the documents`], llm: "skipped", reason: "refuted" } };
    if (current.checkedDocuments.length === 0) current = { ...current, checkedDocuments: [...names] };
  } else if (evidence.length === 0) {
    return { keep: false, finding: current, detail: { programmatic: [...notes, "no verifiable evidence"], llm: "skipped", reason: "no evidence" } };
  } else if (evidence.length < f.evidence.length && f.category === "CONTRADICTION" && evidence.length < 2) {
    return { keep: false, finding: current, detail: { programmatic: [...notes, "contradiction lost one side"], llm: "skipped", reason: "incomplete" } };
  }

  let verdict: "supported" | "weak" | "refuted" = "supported";
  let reason = "";
  try {
    const v = await provider.generate({
      task: "verify",
      system: loadPrompt("system"),
      prompt: loadPrompt("verify"),
      input: {
        finding: { title: current.title, category: current.category, isAbsence: current.isAbsence, evidence: current.evidence, checkedDocuments: current.checkedDocuments },
        documents: chunks.map((c) => ({ documentName: c.documentName, locator: c.locator, text: c.text })),
      },
      schema: VerdictSchema,
    });
    verdict = v.verdict;
    reason = v.reason;
  } catch (e) {
    if (e instanceof ProviderUnavailableError) throw e;
    verdict = "weak";
    reason = "Verifier could not be run";
  }
  if (verdict === "refuted") return { keep: false, finding: current, detail: { programmatic: notes, llm: verdict, reason } };
  if (verdict === "weak") {
    current = {
      ...current,
      confidence: DOWNGRADE[current.confidence],
      factors: { ...current.factors, likelihood: Math.max(1, current.factors.likelihood - 1) },
    };
  }
  return { keep: true, finding: current, detail: { programmatic: notes.length ? notes : ["quotes verified"], llm: verdict, reason } };
}
