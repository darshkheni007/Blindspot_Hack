import { deleteProject, getProject } from "@/lib/data/projects";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk } from "@/lib/http";

export const runtime = "nodejs";
type P = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const p = await getProject(c.ctx.workspaceId, (await params).id);
  return p ? apiOk({ project: p }) : apiError(404, "not_found", "Project not found.");
}

export async function DELETE(_: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const ok = await deleteProject(c.ctx.workspaceId, (await params).id);
  return ok ? apiOk({ ok: true }) : apiError(404, "not_found", "Project not found.");
}
