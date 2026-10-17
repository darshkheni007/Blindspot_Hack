import { startAnalysis, AnalysisStartError } from "@/lib/analysis/service";
import { getProject } from "@/lib/data/projects";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, limit } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const limited = limit(`analyze:${c.ctx.userId}`, 20, 60 * 60_000);
  if (limited) return limited;
  const id = (await params).id;
  if (!(await getProject(c.ctx.workspaceId, id))) return apiError(404, "not_found", "Project not found.");
  try {
    const r = await startAnalysis(c.ctx.workspaceId, id);
    return apiOk({ run: r.run, alreadyRunning: r.alreadyRunning }, r.alreadyRunning ? 200 : 202);
  } catch (e) {
    if (e instanceof AnalysisStartError) return apiError(e.code === "not_found" ? 404 : 422, e.code, e.message);
    return apiError(500, "analysis_failed", "We couldn't start the analysis. Try again.");
  }
}
