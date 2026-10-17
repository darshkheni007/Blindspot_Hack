import { getDetectorCache, getProjectCorpus, putDetectorCache } from "../data/documents";
import { countStats, resolveUnseen, upsertAnalysisFinding, type ScoredFinding } from "../data/findings";
import { syncAssumptions, syncQuestions } from "../data/insights";
import { getProject } from "../data/projects";
import { touchProjectAnalyzed, updateRun } from "../data/runs";
import { runAssumptions } from "./detectors/assumptions";
import { runChecklist } from "./detectors/checklist";
import { runContradictions } from "./detectors/contradictions";
import { runQuantitative } from "./detectors/quantitative";
import { runQuestions } from "./detectors/questions";
import { PROJECT_DOC_ID, projectContextChunk, type DetectorContext } from "./context";
import { dedupe, fingerprintOf } from "./dedupe";
import { PROMPT_VERSION } from "./prompts";
import { ProviderUnavailableError, type LLMProvider } from "./providers/types";
import { priorityScore, sanitizeWeights, type Weights } from "./scoring";
import { projectVocabulary, specificityCheck } from "./specificity";
import { verifyFinding } from "./verifier";
import type { AssumptionCandidate, ChunkInfo, DocInfo, ProjectInfo, RawFinding } from "./types";

export const RUN_FAILURE_MESSAGE = "Something went wrong while analysing. Your documents are safe; please try again.";

interface RunOptions {
  ws: string;
  projectId: string;
  runId: string;
  provider: LLMProvider;
  now?: Date;
}

export async function runAnalysis(opts: RunOptions): Promise<void> {
  const { ws, projectId, runId, provider } = opts;
  const now = opts.now ?? new Date();
  try {
    await execute(opts, now);
  } catch (e) {
    const message = e instanceof ProviderUnavailableError || e instanceof UserFacingError ? e.message : RUN_FAILURE_MESSAGE;
    // Log the error type only: never document contents.
    console.error(`[analysis] run ${runId} failed: ${(e as Error).name}`);
    await updateRun(ws, runId, { status: "FAILED", error: message, finishedAt: new Date() });
  }
  void provider;
  void projectId;
}

export class UserFacingError extends Error {}

async function execute({ ws, projectId, runId, provider }: RunOptions, now: Date) {
  await updateRun(ws, runId, { status: "RUNNING", step: "reading", stepIndex: 0 });
  const project = await getProject(ws, projectId);
  if (!project) throw new UserFacingError("That project no longer exists.");
  const corpus = await getProjectCorpus(ws, projectId);
  if (corpus.docs.length === 0) throw new UserFacingError("Upload at least one document that has finished processing.");

  const info: ProjectInfo = {
    id: project.id,
    name: project.name,
    domain: project.domain,
    stage: project.stage,
    goal: project.goal,
    deadline: project.deadline ? project.deadline.toISOString().slice(0, 10) : null,
    budget: project.budget,
    teamSize: project.teamSize,
    knownRisks: project.knownRisks,
  };
  const weights: Weights = sanitizeWeights(project.weights as Record<string, unknown> | null);
  const ctxChunk = projectContextChunk(info);
  const chunks: ChunkInfo[] = ctxChunk ? [...corpus.chunks, ctxChunk] : corpus.chunks;
  const docs: DocInfo[] = corpus.docs;
  const ctx: DetectorContext = { project: info, docs, chunks, provider, now };
  const vocab = projectVocabulary(chunks);

  // ---- streaming state ----
  const accepted: Array<{ key: string; title: string; category: string; priority: number }> = [];
  const forQuestions: Array<{ key: string; title: string; question: string; owner: string; priority: number; groupKey: string | null }> = [];
  const diff = { newIds: [] as string[], worsenedIds: [] as string[], resolvedIds: [] as string[] };
  const idByKey = new Map<string, string>();
  let dropped = 0;
  let cachedDocs = 0;

  async function processBatch(raw: RawFinding[]) {
    const scored: Array<ScoredFinding & { key: string }> = [];
    for (const f of raw) {
      const v = await verifyFinding(f, chunks, provider);
      if (!v.keep) { dropped++; continue; }
      const s = specificityCheck(v.finding, vocab);
      if (!s.ok) { dropped++; continue; }
      const g = v.finding;
      scored.push({
        key: g.key,
        fingerprint: fingerprintOf(`${projectId}:${g.key}`),
        groupKey: g.groupKey ?? null,
        detector: g.detector,
        title: g.title,
        category: g.category,
        whyItMatters: g.whyItMatters,
        evidence: g.evidence,
        isAbsence: g.isAbsence,
        checkedDocuments: g.checkedDocuments,
        confidence: g.confidence,
        factors: g.factors,
        justifications: g.justifications,
        priority: priorityScore(g.factors, weights),
        disproof: g.disproof,
        question: g.question,
        owner: g.owner,
        nextStep: g.nextStep,
        verifier: { ...v.detail, specificity: s.reason },
      });
    }
    // Dedupe within the batch and against findings already stored by this run.
    const { kept, merged } = dedupe([...accepted.map((a) => ({ ...a, __old: true })), ...scored.map((s) => ({ ...s, __old: false }))]);
    dropped += merged.filter((m) => !(m.dropped as { __old: boolean }).__old).length;
    for (const k of kept) {
      if ((k as { __old: boolean }).__old) continue;
      const item = k as unknown as ScoredFinding & { key: string };
      const res = await upsertAnalysisFinding(ws, projectId, runId, item);
      idByKey.set(item.key, res.id);
      if (res.state === "NEW") diff.newIds.push(res.id);
      if (res.state === "WORSENED") diff.worsenedIds.push(res.id);
      accepted.push({ key: item.key, title: item.title, category: item.category, priority: item.priority });
      forQuestions.push({ key: item.key, title: item.title, question: item.question, owner: item.owner, priority: item.priority, groupKey: item.groupKey });
    }
  }

  // ---- step 1: assumptions + checklist gaps ----
  await updateRun(ws, runId, { step: "assumptions", stepIndex: 1 });
  const allAssumptions: AssumptionCandidate[] = [];
  for (const doc of docs) {
    const cacheKey = `${doc.contentHash}:${PROMPT_VERSION}:${provider.model}:${info.domain}`;
    const hit = (await getDetectorCache(ws, doc.id, "assumptions", cacheKey)) as { assumptions: AssumptionCandidate[]; findings: RawFinding[] } | null;
    let result: { assumptions: AssumptionCandidate[]; findings: RawFinding[] };
    if (hit) {
      result = hit;
      cachedDocs++;
    } else {
      const r = await runAssumptions(ctx, doc);
      dropped += r.dropped;
      result = { assumptions: r.assumptions, findings: r.findings };
      await putDetectorCache(ws, doc.id, "assumptions", cacheKey, result);
    }
    allAssumptions.push(...result.assumptions);
    await processBatch(result.findings);
  }
  const checklist = await runChecklist(ctx);
  dropped += checklist.dropped;
  await processBatch(checklist.findings);

  // ---- step 2: contradictions + quantitative ----
  await updateRun(ws, runId, { step: "contradictions", stepIndex: 2 });
  const contradictions = await runContradictions(ctx);
  dropped += contradictions.dropped;
  await processBatch(contradictions.findings);
  const quant = await runQuantitative(ctx);
  dropped += quant.dropped;
  await processBatch(quant.findings);

  // ---- step 3: ranking, questions, bookkeeping ----
  await updateRun(ws, runId, { step: "ranking", stepIndex: 3 });
  const q = await runQuestions(ctx, { project: { name: info.name }, findings: forQuestions, assumptions: allAssumptions });
  dropped += q.dropped;
  await syncAssumptions(ws, projectId, allAssumptions);
  await syncQuestions(ws, projectId, q.questions.map((x) => ({ ...x, findingId: x.findingKey ? idByKey.get(x.findingKey) ?? null : null })));
  diff.resolvedIds = await resolveUnseen(ws, projectId, runId);
  const stats = await countStats(ws, projectId);
  await updateRun(ws, runId, {
    status: "COMPLETED",
    step: "done",
    stepIndex: 4,
    stats: { total: stats.total, open: stats.open, critical: stats.critical, dropped, cachedDocs },
    diff,
    finishedAt: new Date(),
  });
  await touchProjectAnalyzed(ws, projectId);
  void PROJECT_DOC_ID;
}
