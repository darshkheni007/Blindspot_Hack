import { loadPrompt } from "../prompts";
import { shortHash, normalize } from "../text";
import { LooseOutputSchema, QuestionCandidateSchema, validateItems, type AssumptionCandidate, type QuestionCandidate } from "../types";
import type { DetectorContext } from "../context";

export interface QuestionsInput {
  project: { name: string };
  findings: Array<{ key: string; title: string; question: string; owner: string; priority: number; groupKey: string | null }>;
  assumptions: AssumptionCandidate[];
}

const GROUP_LABEL: Record<string, string> = {
  schedule: "schedule and dates",
  budget: "budget and cost",
  capacity: "team capacity",
  "launch-readiness": "launch readiness",
  "data-integrity": "data integrity",
  compliance: "compliance",
  "people-adoption": "people and adoption",
  regulatory: "regulatory approvals",
  governance: "governance",
  scope: "scope",
  design: "design",
};

/** Rule-based stand-in for the LLM: turns findings into the questions nobody has asked yet. */
export function localQuestions(input: QuestionsInput): { questions: QuestionCandidate[] } {
  const qs: QuestionCandidate[] = [];
  for (const f of [...input.findings].sort((a, b) => b.priority - a.priority)) {
    qs.push({ text: f.question, suggestedOwner: f.owner, findingKey: f.key, key: `q:${f.key}` });
  }
  const groups = new Map<string, number>();
  for (const f of input.findings) if (f.groupKey) groups.set(f.groupKey, (groups.get(f.groupKey) ?? 0) + 1);
  for (const [g, n] of groups) {
    if (n >= 2 && qs.length < 40) {
      const label = GROUP_LABEL[g] ?? g.replace(/-/g, " ");
      qs.push({
        text: `${n} gaps in ${input.project.name} trace back to the same area (${label}). Who owns fixing them together, and by when?`,
        suggestedOwner: "Project sponsor",
        key: `q:group:${g}`,
      });
    }
  }
  const covered = new Set(input.findings.map((f) => f.key));
  for (const a of input.assumptions.slice(0, 3)) {
    if (covered.has(a.key)) continue;
    qs.push({
      text: `What evidence supports “${a.statement.slice(0, 100)}” and who confirms it?`,
      suggestedOwner: "Project owner",
      key: `q:${a.key}-${shortHash(normalize(a.statement)).slice(0, 4)}`,
    });
  }
  return { questions: qs };
}

export async function runQuestions(ctx: DetectorContext, input: QuestionsInput) {
  const out = await ctx.provider.generate({
    task: "questions",
    system: loadPrompt("system"),
    prompt: loadPrompt("questions"),
    input,
    schema: LooseOutputSchema,
  });
  const q = validateItems(out.questions, QuestionCandidateSchema);
  return { questions: q.valid, dropped: q.dropped };
}
