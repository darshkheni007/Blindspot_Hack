import { getProjectCorpus } from "../data/documents";
import { createRun, failStaleRuns, getActiveRun, type RunDTO } from "../data/runs";
import { getQueue } from "../queue";
import { runAnalysis } from "./pipeline";
import { PROMPT_VERSION } from "./prompts";
import { getProvider } from "./providers";
import type { LLMProvider } from "./providers/types";

export class AnalysisStartError extends Error {
  constructor(message: string, readonly code: "no_documents" | "not_found") {
    super(message);
  }
}

/** Creates a run record and queues the work. Returns immediately; progress is read from the database. */
export async function startAnalysis(ws: string, projectId: string, opts: { provider?: LLMProvider; now?: Date } = {}): Promise<{ run: RunDTO; alreadyRunning: boolean }> {
  await failStaleRuns(ws, projectId);
  const active = await getActiveRun(ws, projectId);
  if (active) return { run: active, alreadyRunning: true };
  const corpus = await getProjectCorpus(ws, projectId);
  if (corpus.docs.length === 0) {
    throw new AnalysisStartError("Upload at least one document and wait for it to finish processing.", "no_documents");
  }
  const provider = opts.provider ?? getProvider();
  const run = await createRun(ws, projectId, {
    provider: provider.name,
    model: provider.model,
    promptVersion: PROMPT_VERSION,
    docHashes: Object.fromEntries(corpus.docs.map((d) => [d.id, d.contentHash])),
  });
  if (!run) throw new AnalysisStartError("Project not found.", "not_found");
  getQueue().enqueue({
    id: run.id,
    key: `analysis:${projectId}`,
    run: () => runAnalysis({ ws, projectId, runId: run.id, provider, now: opts.now }),
  });
  return { run, alreadyRunning: false };
}
