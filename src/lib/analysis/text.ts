import type { ChunkInfo } from "./types";

export const STOP = new Set(
  "a an the and or of to in on for with by at from as is are was were be been being it its this that these those we our you your they their will would should could can may might must not no do does did has have had if then than so such into over under about after before between within without per via also more most less least any all each both other another".split(" "),
);

/** Words that appear in almost every project; a finding made only of these is generic. */
export const GENERIC = new Set(
  "project plan planning risk risks security testing test quality process processes team teams timeline schedule budget cost costs resources resource stakeholders stakeholder documentation document requirements requirement system systems solution solutions management manage support users user data information review reviews approach strategy goals goal objectives objective deliverables deliverable best practices practice consider ensure provide need needs important key overall general".split(" "),
);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[*_`#>]/g, "")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9$%.\-]+/)
    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds a case-insensitive regex for a term; spaces/hyphens are interchangeable ("go-live" ≈ "go live"). */
export function termRegex(term: string): RegExp {
  const body = escapeRe(term.trim()).replace(/(?:\\-|\s)+/g, "[\\s\\-]*");
  // Prefix match on the right so "reconcil" matches "reconciliation"; left edge is a word boundary.
  return new RegExp(`(?<![A-Za-z0-9])${body}`, "i");
}

export function corpusText(chunks: ChunkInfo[]): string {
  return chunks.map((c) => c.text).join("\n");
}

const NEGATED = /\b(?:without|no|not|never|zero|lack of|absence of)\s+(?:\w+\s+){0,2}$/i;

/** First term that is genuinely mentioned. A mention like "without additional training" does not count. */
export function hasAnyTerm(text: string, terms: string[]): string | null {
  for (const t of terms) {
    const re = new RegExp(termRegex(t).source, "gi");
    for (const m of text.matchAll(re)) {
      const before = text.slice(Math.max(0, m.index! - 40), m.index!);
      if (!NEGATED.test(before)) return t;
    }
  }
  return null;
}

export interface QuoteHit {
  chunk: ChunkInfo;
  quote: string;
  term: string;
}

/** Returns a verbatim sentence/line from a chunk that contains the term (≤ maxLen chars). */
export function sentenceAround(text: string, index: number, matchLen: number, maxLen = 320): string {
  // Expand to sentence/line boundaries.
  let start = index;
  while (start > 0 && !/[\n]/.test(text[start - 1]) && !(/[.!?]/.test(text[start - 1]) && /\s/.test(text[start]))) start--;
  let end = index + matchLen;
  while (end < text.length && text[end] !== "\n" && !(/[.!?]/.test(text[end - 1]) && /\s/.test(text[end]))) end++;
  let q = text.slice(start, end).trim();
  if (q.length > maxLen) {
    const rel = index - start;
    const from = Math.max(0, rel - Math.floor(maxLen / 2));
    q = q.slice(from, from + maxLen).trim();
  }
  return q;
}

export function findQuotes(chunks: ChunkInfo[], terms: string[], max = 2): QuoteHit[] {
  const hits: QuoteHit[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const re = termRegex(term);
    for (const chunk of chunks) {
      const m = re.exec(chunk.text);
      if (!m) continue;
      const quote = sentenceAround(chunk.text, m.index, m[0].length);
      const id = `${chunk.documentId}:${chunk.locator}`;
      if (quote.length < 3 || seen.has(id)) continue;
      seen.add(id);
      hits.push({ chunk, quote, term });
      if (hits.length >= max) return hits;
    }
  }
  return hits;
}

export function verbatim(chunks: ChunkInfo[], documentName: string, quote: string): boolean {
  const q = normalize(quote);
  return chunks.some((c) => c.documentName === documentName && normalize(c.text).includes(q));
}

export function jaccard(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function shortHash(s: string): string {
  let h1 = 0xdeadbeef ^ 0,
    h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
