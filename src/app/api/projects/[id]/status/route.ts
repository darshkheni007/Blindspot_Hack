import { listDocuments } from "@/lib/data/documents";
import { countStats } from "@/lib/data/findings";
import { getProject } from "@/lib/data/projects";
import { getLatestRun, getRunDocHashes } from "@/lib/data/runs";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk } from "@/lib/http";

export const runtime = "nodejs";

/** Cheap polling endpoint: latest run, document statuses, finding counts and whether documents changed since the last analysis. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const id = (await params).id;
  const ws = c.ctx.workspaceId;
  const project = await getProject(ws, id);
  if (!project) return apiError(404, "not_found", "Project not found.");
  const [run, docs, stats, hashes] = await Promise.all([getLatestRun(ws, id), listDocuments(ws, id), countStats(ws, id), getRunDocHashes(ws, id)]);
  const ready = docs.filter((d) => d.status === "READY");
  const stale = hashes !== null && (ready.length !== Object.keys(hashes).length || ready.some((d) => hashes[d.id] !== d.contentHash));
  return apiOk({
    project: { id: project.id, name: project.name, weights: project.weights, lastAnalyzedAt: project.lastAnalyzedAt?.toISOString() ?? null },
    run,
    documents: docs.map((d) => ({ id: d.id, name: d.name, status: d.status, error: d.error })),
    stats,
    stale,
  });
}
