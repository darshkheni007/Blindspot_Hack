import { getProject } from "@/lib/data/projects";
import { listRuns } from "@/lib/data/runs";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const id = (await params).id;
  if (!(await getProject(c.ctx.workspaceId, id))) return apiError(404, "not_found", "Project not found.");
  return apiOk({ runs: await listRuns(c.ctx.workspaceId, id) });
}
