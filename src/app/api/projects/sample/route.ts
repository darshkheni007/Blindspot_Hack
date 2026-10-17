import { PLANS } from "@/config/app";
import { getUsage } from "@/lib/data/workspaces";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, limit } from "@/lib/http";
import { createSampleProject } from "@/lib/sample";

export const runtime = "nodejs";

export async function POST() {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const limited = limit(`sample:${c.ctx.userId}`, 5, 60 * 60_000);
  if (limited) return limited;
  const usage = await getUsage(c.ctx.workspaceId);
  if (usage.projects >= usage.maxProjects) return apiError(402, "plan_limit", `Your ${PLANS[usage.plan].label} plan allows ${usage.maxProjects} projects.`);
  const p = await createSampleProject(c.ctx.workspaceId);
  return apiOk({ id: p.id }, 201);
}
