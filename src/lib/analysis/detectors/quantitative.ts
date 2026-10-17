import { loadPrompt } from "../prompts";
import { corpusPayload, proximityFor, type DetectorContext } from "../context";
import { extractFacts, type Fact } from "../facts";
import { LooseOutputSchema, RawFindingSchema, validateItems, type ChunkInfo, type RawFinding } from "../types";
import type { CorpusInput } from "./contradictions";
import { cap, ev, finding, fmtDay } from "./helpers";

interface Row {
  chunk: ChunkInfo;
  label: string;
  amount: number;
}

const NUM = /^[$€£₹]?\s?\(?-?[\d,]+(?:\.\d+)?\)?$/;
function toNumber(v: string): number | null {
  const t = v.trim().replace(/[$€£₹\s]/g, "");
  if (!NUM.test(v.trim())) return null;
  const neg = t.startsWith("(") || t.startsWith("-");
  const n = parseFloat(t.replace(/[(),-]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Table rows in the parsed text look like "Item: Hosting | Cost (USD): 120,000". */
function parseRows(chunks: ChunkInfo[]): Row[] {
  const rows: Row[] = [];
  for (const chunk of chunks) {
    if (chunk.text.startsWith("Columns:") || !chunk.text.includes(" | ")) continue;
    const cells = chunk.text.split(" | ").map((p) => {
      const i = p.indexOf(": ");
      return i === -1 ? { h: "", v: p } : { h: p.slice(0, i), v: p.slice(i + 2) };
    });
    const label = cells.find((c) => toNumber(c.v) === null)?.v ?? "";
    const numeric = cells.filter((c) => toNumber(c.v) !== null);
    const pref = numeric.find((c) => /amount|cost|total|price|usd|inr|eur|value|budget|estimate/i.test(c.h)) ?? numeric[numeric.length - 1];
    if (!label || !pref) continue;
    rows.push({ chunk, label: label.trim(), amount: toNumber(pref.v)! });
  }
  return rows;
}

function addDays(f: Fact) {
  return f.value;
}

const first = (facts: Fact[], label: string, kind: Fact["kind"]) => facts.filter((f) => f.label === label && f.kind === kind);

/** Rule-based stand-in for the LLM: date order, totals, budget fit and effort-versus-capacity arithmetic. */
export function localQuantitative(input: CorpusInput, ctx: Pick<DetectorContext, "project" | "now">): RawFinding[] {
  const out: RawFinding[] = [];
  const facts = extractFacts(input.chunks).filter((f) => !/\b(previously|originally|formerly|last (?:year|quarter))\b/i.test(f.sentence));
  const today = Math.floor(ctx.now.getTime() / 86400000);

  // --- date order ---
  const goLive = first(facts, "go-live date", "date").sort((a, b) => b.value - a.value);
  const deadline = first(facts, "deadline", "date");
  const start = first(facts, "project start", "date");
  const shutdown = first(facts, "legacy shutdown", "date");
  const uat = first(facts, "UAT", "date");

  const g = goLive[0];
  const dl = deadline.find((d) => g && d.value < g.value);
  if (g && dl) {
    const days = g.value - dl.value;
    const prox = proximityFor(ctx, dl.value);
    out.push(
      finding({
        detector: "quantitative",
        key: "quant:golive-after-deadline",
        category: "CONTRADICTION",
        title: `Go-live (${fmtDay(g.value)}) falls ${days} days after the stated deadline (${fmtDay(dl.value)})`,
        whyItMatters: `The plan cannot meet its own deadline as written: ${fmtDay(dl.value)} to ${fmtDay(g.value)} is ${days} days. Someone has either moved the deadline without recording it or is planning to miss it.`,
        evidence: [ev(g.chunk.documentName, g.chunk.locator, g.sentence, `Go-live ${fmtDay(g.value)}`), ev(dl.chunk.documentName, dl.chunk.locator, dl.sentence, `Deadline ${fmtDay(dl.value)}`)],
        confidence: "EVIDENCE_BACKED",
        factors: { impact: 5, likelihood: 5, irreversibility: 3, proximity: prox.value, cost: 1 },
        justifications: {
          impact: "A missed fixed deadline affects contracts, budget and credibility",
          likelihood: "Both dates are quoted from the documents",
          irreversibility: "Once the deadline passes, consequences cannot be undone",
          proximity: prox.reason,
          cost: "One decision: move the deadline or the go-live",
        },
        disproof: "A change record moving the deadline, or evidence the two dates refer to different milestones.",
        question: `Is the deadline ${fmtDay(dl.value)} or the go-live ${fmtDay(g.value)} — and who has authority to move the other?`,
        owner: "Project sponsor",
        nextStep: "Decide which date is fixed, then rebaseline the plan and update both documents.",
        groupKey: "schedule",
      }),
    );
  }
  const s0 = start[0];
  if (g && s0 && s0.value >= g.value) {
    out.push(
      finding({
        detector: "quantitative",
        key: "quant:start-after-golive",
        category: "DATA_ISSUE",
        title: `Project start (${fmtDay(s0.value)}) is on or after go-live (${fmtDay(g.value)})`,
        whyItMatters: "The dates cannot both be right; at least one is a typo or an outdated value, and any duration or effort calculation built on them is wrong.",
        evidence: [ev(s0.chunk.documentName, s0.chunk.locator, s0.sentence, "Start"), ev(g.chunk.documentName, g.chunk.locator, g.sentence, "Go-live")],
        confidence: "EVIDENCE_BACKED",
        factors: { impact: 3, likelihood: 5, irreversibility: 1, proximity: 3, cost: 1 },
        justifications: { impact: "Planning built on impossible dates", likelihood: "Both dates are quoted", irreversibility: "Easy to correct once seen", proximity: "Affects the plan immediately", cost: "A quick check of two dates" },
        disproof: "Evidence the two dates belong to different projects or phases.",
        question: "Which of the start and go-live dates is wrong?",
        owner: "Project manager",
        nextStep: "Correct the date and re-run any duration-based estimates.",
        groupKey: "schedule",
      }),
    );
  }
  const sh = shutdown[0];
  if (g && sh) {
    const margin = sh.value - g.value;
    if (margin < 45) {
      const prox = proximityFor(ctx, g.value);
      out.push(
        finding({
          detector: "quantitative",
          key: margin < 0 ? "quant:legacy-ends-before-cutover" : "quant:no-parallel-run",
          category: "CONSTRAINT",
          title:
            margin === 0
              ? `Go-live and the end of the legacy contract both fall on ${fmtDay(g.value)}, leaving no parallel run or rollback window`
              : margin < 0
              ? `Legacy access ends on ${fmtDay(sh.value)}, ${-margin} days before the planned go-live on ${fmtDay(g.value)}`
              : `Only ${margin} days separate go-live (${fmtDay(g.value)}) from the legacy end date (${fmtDay(sh.value)}), leaving almost no parallel running or rollback window`,
          whyItMatters:
            margin < 0
              ? "If the old system or contract ends before the new one is live, there is a gap in service, and no fallback if cutover slips."
              : `A ${margin}-day margin means any cutover delay or rollback runs into the end of the legacy contract, leaving no safe way back.`,
          evidence: [ev(g.chunk.documentName, g.chunk.locator, g.sentence, `Go-live ${fmtDay(g.value)}`), ev(sh.chunk.documentName, sh.chunk.locator, sh.sentence, `Legacy end ${fmtDay(sh.value)}`)],
          confidence: "EVIDENCE_BACKED",
          factors: { impact: 5, likelihood: margin < 0 ? 5 : 3, irreversibility: 4, proximity: prox.value, cost: 2 },
          justifications: {
            impact: "Loss of the fallback system turns a slip into an outage",
            likelihood: margin < 0 ? "The dates as written already conflict" : "Cutovers commonly slip by more than a few weeks",
            irreversibility: "Once the legacy contract or system is gone it cannot be restored quickly",
            proximity: prox.reason,
            cost: "Negotiate an extension or move the dates",
          },
          disproof: "A signed extension, or evidence that the legacy system stays available after the stated date.",
          question: "What happens to the business if cutover slips past the legacy end date, and can the contract be extended?",
          owner: "Procurement / Project sponsor",
          nextStep: "Ask the vendor for the cost and notice period of a short extension and add it to the plan as a contingency.",
          groupKey: "schedule",
        }),
      );
    }
  }
  const u = uat[0];
  if (g && u && u.value > g.value) {
    out.push(
      finding({
        detector: "quantitative",
        key: "quant:uat-after-golive",
        category: "CONTRADICTION",
        title: `User acceptance testing (${fmtDay(u.value)}) is scheduled after go-live (${fmtDay(g.value)})`,
        whyItMatters: "Acceptance testing after release means defects are found by customers instead of before launch.",
        evidence: [ev(u.chunk.documentName, u.chunk.locator, u.sentence, "UAT"), ev(g.chunk.documentName, g.chunk.locator, g.sentence, "Go-live")],
        confidence: "EVIDENCE_BACKED",
        factors: { impact: 4, likelihood: 4, irreversibility: 3, proximity: 4, cost: 1 },
        justifications: { impact: "Untested release", likelihood: "Dates quoted directly", irreversibility: "Defects reach users", proximity: "Dates are in the plan", cost: "Reorder milestones" },
        disproof: "Evidence the UAT date refers to a later phase.",
        question: "Should UAT finish before go-live, and which date moves?",
        owner: "QA lead",
        nextStep: "Re-sequence the plan so UAT ends before go-live.",
        groupKey: "schedule",
      }),
    );
  }

  // --- tables: totals that do not add up ---
  const rows = parseRows(input.chunks);
  const byDoc = new Map<string, Row[]>();
  for (const r of rows) (byDoc.get(r.chunk.documentId) ?? byDoc.set(r.chunk.documentId, []).get(r.chunk.documentId)!).push(r);
  const tableTotals: Array<{ row: Row; sum: number | null }> = [];
  for (const [, list] of byDoc) {
    let sum = 0;
    const lines: Row[] = [];
    for (const r of list) {
      if (/^(grand\s+)?total\b/i.test(r.label)) {
        tableTotals.push({ row: r, sum: lines.length ? sum : null });
        if (lines.length >= 2 && Math.abs(sum - r.amount) / Math.max(1, Math.abs(r.amount)) > 0.01) {
          const diff = r.amount - sum;
          out.push(
            finding({
              detector: "quantitative",
              key: `quant:sum-mismatch:${r.chunk.documentId}`,
              category: "DATA_ISSUE",
              title: `${r.chunk.documentName}: the total (${r.amount.toLocaleString("en")}) does not equal the sum of its ${lines.length} lines (${sum.toLocaleString("en")})`,
              whyItMatters: `The lines add up to ${sum.toLocaleString("en")} but the stated total is ${r.amount.toLocaleString("en")}, a difference of ${Math.abs(diff).toLocaleString("en")}. Either a line is missing or the total is stale, so any decision made on the total is built on the wrong number.`,
              evidence: [
                ev(r.chunk.documentName, r.chunk.locator, r.chunk.text, "Stated total"),
                ev(lines[0].chunk.documentName, `${lines[0].chunk.locator} … ${lines[lines.length - 1].chunk.locator}`, lines[0].chunk.text, `First of ${lines.length} lines summed`),
              ],
              confidence: "EVIDENCE_BACKED",
              factors: { impact: 4, likelihood: 5, irreversibility: 2, proximity: 3, cost: 1 },
              justifications: {
                impact: "Budget decisions are made on the total",
                likelihood: "The arithmetic is checkable from the quoted rows",
                irreversibility: "Easy to fix once noticed, costly if approved",
                proximity: "Affects any budget approval now",
                cost: "Re-add the rows",
              },
              disproof: "A line that was intentionally excluded from the sum, or hidden rows that account for the difference.",
              question: `Why does the stated total differ from the sum of the lines by ${Math.abs(diff).toLocaleString("en")}?`,
              owner: "Finance partner",
              nextStep: "Recompute the total from the lines and update the document.",
              groupKey: "budget",
            }),
          );
        }
        sum = 0;
        lines.length = 0;
      } else if (!/sub-?total/i.test(r.label)) {
        sum += r.amount;
        lines.push(r);
      }
    }
  }

  // --- estimated total vs approved budget ---
  const budgets = first(facts, "approved budget", "money");
  const totalsProse = first(facts, "estimated total", "money").map((f) => ({ value: f.value, display: f.display, chunk: f.chunk, sentence: f.sentence }));
  const totalsTable = tableTotals.map((t) => ({ value: t.row.amount, display: t.row.amount.toLocaleString("en"), chunk: t.row.chunk, sentence: t.row.chunk.text }));
  const totals = [...totalsTable, ...totalsProse];
  const b = budgets[0];
  const tot = b ? totals.filter((t) => t.chunk.documentId !== b.chunk.documentId || t.chunk.locator !== b.chunk.locator).sort((x, y) => y.value - x.value)[0] : undefined;
  if (b && tot && tot.value > b.value * 1.02) {
    const over = tot.value - b.value;
    const pct = Math.round((over / b.value) * 100);
    out.push(
      finding({
        detector: "quantitative",
        key: "quant:total-exceeds-budget",
        category: "CONTRADICTION",
        title: `The estimated total (${tot.display}) in ${tot.chunk.documentName} exceeds the stated budget (${b.display}) by ${over.toLocaleString("en")} (${pct}%)`,
        whyItMatters: `${b.chunk.documentName} commits to ${b.display}, but ${tot.chunk.documentName} adds up to ${tot.display}. The ${pct}% gap is unfunded unless someone has already agreed to cover it.`,
        evidence: [ev(b.chunk.documentName, b.chunk.locator, b.sentence, `Budget ${b.display}`), ev(tot.chunk.documentName, tot.chunk.locator, tot.sentence, `Total ${tot.display}`)],
        confidence: "EVIDENCE_BACKED",
        factors: { impact: 4, likelihood: 5, irreversibility: 3, proximity: proximityFor(ctx).value, cost: 2 },
        justifications: {
          impact: "An unfunded gap forces a scope cut or a late funding request",
          likelihood: "Both figures are quoted from the documents",
          irreversibility: "Spend committed against the lower budget is hard to recover",
          proximity: proximityFor(ctx).reason,
          cost: "Needs a funding or scope decision",
        },
        disproof: "Approval of the higher figure, or evidence that part of the total is funded from another budget.",
        question: `Who covers the ${over.toLocaleString("en")} difference between the budget and the estimate, or what is cut?`,
        owner: "Project sponsor / Finance partner",
        nextStep: "Take the gap to the budget owner with options: more funding, reduced scope, or phasing.",
        groupKey: "budget",
      }),
    );
  }

  // --- effort vs capacity ---
  const team = first(facts, "team size", "count").filter((f) => f.unit === "people")[0];
  const effort = facts.find((f) => f.label === "effort" && f.kind === "count" && f.unit?.startsWith("person"));
  if (team && effort) {
    const effortMonths = effort.unit === "person-day" ? effort.value / 21 : effort.value;
    const endDay = g?.value ?? deadline[0]?.value;
    const startDay = s0?.value ?? today;
    if (endDay && endDay > startDay) {
      const months = (endDay - startDay) / 30.4;
      const capacity = team.value * months * 0.85;
      if (effortMonths > capacity * 1.05) {
        const prox = proximityFor(ctx, endDay);
        out.push(
          finding({
            detector: "quantitative",
            key: "quant:effort-exceeds-capacity",
            category: "CONSTRAINT",
            title: `The estimated effort (${effort.display}) is more than a team of ${team.value} can deliver by ${fmtDay(endDay)}`,
            whyItMatters: `From ${s0 ? fmtDay(startDay) : "today"} to ${fmtDay(endDay)} is about ${months.toFixed(1)} months. A team of ${team.value} at 85% productive time gives roughly ${capacity.toFixed(0)} person-months, against ${effortMonths.toFixed(0)} required: a shortfall of about ${(effortMonths - capacity).toFixed(0)} person-months.`,
            evidence: [ev(team.chunk.documentName, team.chunk.locator, team.sentence, `Team ${team.value}`), ev(effort.chunk.documentName, effort.chunk.locator, effort.sentence, `Effort ${effort.display}`)],
            confidence: "INFERRED",
            factors: { impact: 5, likelihood: 4, irreversibility: 3, proximity: prox.value, cost: 3 },
            justifications: {
              impact: "Either the date slips, scope is cut or quality drops",
              likelihood: "The arithmetic uses the project's own numbers (85% utilisation assumed)",
              irreversibility: "Late hiring rarely recovers lost time",
              proximity: prox.reason,
              cost: "Requires adding people, cutting scope or moving the date",
            },
            disproof: "Evidence of additional staff not mentioned in the documents, or an effort estimate that is not in person-time.",
            question: `How will ${effortMonths.toFixed(0)} person-months of work fit into ${capacity.toFixed(0)} person-months of capacity — more people, less scope, or a later date?`,
            owner: "Delivery manager",
            nextStep: "Reconcile the effort estimate with real capacity and decide which of scope, people or date changes.",
            groupKey: "capacity",
          }),
        );
      }
    }
  }
  void addDays;
  void cap;
  return out;
}

export async function runQuantitative(ctx: DetectorContext) {
  const out = await ctx.provider.generate({
    task: "quantitative",
    system: loadPrompt("system") + "\n\n" + loadPrompt("schema"),
    prompt: loadPrompt("quantitative"),
    input: corpusPayload(ctx),
    schema: LooseOutputSchema,
  });
  const f = validateItems(out.findings, RawFindingSchema);
  return { findings: f.valid, dropped: f.dropped };
}
