import { GENERIC, STOP, tokens } from "./text";
import type { ChunkInfo, RawFinding } from "./types";

const BOILERPLATE: RegExp[] = [
  /^(consider|ensure|make sure|remember to|you should|it is important|be sure)\b/i,
  /\bbest[- ]practices?\b/i,
  /\bindustry[- ]standard\b/i,
  /\b(?:as appropriate|where applicable|if needed)\b/i,
  /^(add|improve|increase|do) more (?:testing|documentation|planning|security)\b/i,
];

export function projectVocabulary(chunks: ChunkInfo[]): Set<string> {
  const v = new Set<string>();
  for (const c of chunks) for (const t of tokens(c.text)) if (!GENERIC.has(t) && !STOP.has(t)) v.add(t);
  return v;
}

/**
 * Discards findings that could apply to any project. A finding must (a) not be boilerplate and
 * (b) share at least two non-generic terms (or a number/date) with the project's own documents
 * through its title and quoted evidence.
 */
export function specificityCheck(f: RawFinding, vocab: Set<string>): { ok: boolean; reason: string } {
  if (BOILERPLATE.some((re) => re.test(f.title))) return { ok: false, reason: "boilerplate wording" };
  const bag = [f.title, ...f.evidence.map((e) => e.quote)].join(" ");
  const specific = new Set<string>();
  for (const t of tokens(bag)) {
    if (/\d/.test(t) || (vocab.has(t) && !GENERIC.has(t))) specific.add(t);
  }
  if (specific.size < 2) return { ok: false, reason: `only ${specific.size} project-specific term(s)` };
  return { ok: true, reason: `${specific.size} project-specific terms` };
}
