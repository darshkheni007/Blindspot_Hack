import { loadPrompt } from "../prompts";
import { checklistFor } from "../checklists";
import { corpusPayload, docNames, proximityFor, type DetectorContext } from "../context";
import { findQuotes, hasAnyTerm, termRegex } from "../text";
import { LooseOutputSchema, RawFindingSchema, validateItems, type ChecklistItem, type ChunkInfo, type ProjectInfo, type RawFinding } from "../types";
import { cap, ev, finding } from "./helpers";

export interface ChecklistInput {
  project: ProjectInfo;
  documents: Array<{ name: string; type: string }>;
  chunks: ChunkInfo[];
  checklist: ChecklistItem[];
}

/** Returns the word as written in the documents that contains the anchor stem (e.g. "migrat" → "migration"). */
function writtenForm(chunks: ChunkInfo[], term: string): { word: string; count: number } | null {
  const re = termRegex(term);
  let count = 0;
  let word = "";
  for (const c of chunks) {
    const g = new RegExp(re.source, "gi");
    for (const m of c.text.matchAll(g)) {
      count++;
      if (!word) {
        const tail = /^[A-Za-z-]*/.exec(c.text.slice(m.index! + m[0].length))?.[0] ?? "";
        word = (m[0] + tail).toLowerCase();
      }
    }
  }
  return count ? { word, count } : null;
}

const fill = (s: string, anchor: string) => s.replaceAll("{anchor}", anchor);

/** Rule-based stand-in for the LLM: a topic is a gap when its anchor is present and none of its keywords are. */
export function localChecklist(input: ChecklistInput, ctx: Pick<DetectorContext, "project" | "now">): { findings: RawFinding[] } {
  const all = input.chunks.map((c) => c.text).join("\n");
  const names = input.documents.map((d) => d.name);
  const out: RawFinding[] = [];
  for (const item of input.checklist) {
    if (hasAnyTerm(all, item.keywords)) continue; // addressed
    let anchorTerm: string | null = null;
    let anchor = "";
    if (item.anchors.length) {
      let best = 0;
      for (const a of item.anchors) {
        const w = writtenForm(input.chunks, a);
        if (w && w.count > best) {
          best = w.count;
          anchorTerm = a;
          anchor = w.word;
        }
      }
      if (!anchorTerm) continue; // topic does not apply to this project
    } else {
      anchor = item.label.toLowerCase();
    }
    const quotes = anchorTerm ? findQuotes(input.chunks, [anchorTerm], 2) : [];
    if (item.anchors.length && quotes.length === 0) continue;
    const prox = proximityFor(ctx);
    const f = item.factors;
    const shown = item.keywords.slice(0, 3).map((k) => `“${k}”`).join(", ");
    out.push(
      finding({
        detector: "checklist",
        key: `checklist:${item.id}`,
        category: item.category,
        title: cap(fill(item.title, anchor)),
        whyItMatters: fill(item.why, anchor),
        evidence: quotes.map((q) => ev(q.chunk.documentName, q.chunk.locator, q.quote, `Mentions the ${anchor}`)),
        isAbsence: true,
        checkedDocuments: names,
        absenceTerms: item.keywords,
        confidence: "PATTERN_BASED",
        factors: { impact: f.impact, likelihood: f.likelihood, irreversibility: f.irreversibility, proximity: Math.max(f.proximity, prox.value), cost: f.cost },
        justifications: {
          impact: fill(item.justifications.impact, anchor),
          likelihood: `None of the ${names.length} document${names.length === 1 ? "" : "s"} mention ${shown}`,
          irreversibility: fill(item.justifications.irreversibility, anchor),
          proximity: prox.reason,
          cost: fill(item.justifications.cost, anchor),
        },
        disproof: fill(item.disproof, anchor),
        question: fill(item.question, anchor),
        owner: item.owner,
        nextStep: fill(item.nextStep, anchor),
        groupKey: item.group,
      }),
    );
  }
  // Keep the strongest few so a long checklist never floods the list.
  out.sort((a, b) => b.factors.impact * b.factors.likelihood - a.factors.impact * a.factors.likelihood);
  return { findings: out.slice(0, 5) };
}

export async function runChecklist(ctx: DetectorContext) {
  const checklist = checklistFor(ctx.project.domain);
  const p = corpusPayload(ctx);
  const input: ChecklistInput = { project: ctx.project, documents: p.documents, chunks: ctx.chunks, checklist };
  const out = await ctx.provider.generate({
    task: "checklist",
    system: loadPrompt("system") + "\n\n" + loadPrompt("schema"),
    prompt: loadPrompt("checklist") + `\n\nDocuments checked: ${docNames(ctx).join("; ")}`,
    input: { ...input, chunks: p.chunks },
    schema: LooseOutputSchema,
  });
  const f = validateItems(out.findings, RawFindingSchema);
  return { findings: f.valid, dropped: f.dropped };
}
