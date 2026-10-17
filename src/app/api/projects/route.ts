import { z } from "zod";
import { PLANS } from "@/config/app";
import { createProject, listProjects } from "@/lib/data/projects";
import { getUsage } from "@/lib/data/workspaces";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, limit, parseBody } from "@/lib/http";

export const runtime = "nodejs";

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name.").max(120),
  domain: z.enum(["SOFTWARE", "CONSTRUCTION", "HEALTHCARE", "FINANCE", "DATA_ML", "OTHER"]),
  stage: z.enum(["PROPOSAL", "IN_PROGRESS", "PRE_LAUNCH"]),
  goal: z.string().trim().min(1, "Describe the goal in a sentence or two.").max(1000),
  deadline: z.string().date().nullish().or(z.literal("").transform(() => null)),
  budget: z.string().trim().max(60).nullish().or(z.literal("").transform(() => null)),
  teamSize: z.coerce.number().int().min(1).max(100000).nullish().or(z.literal("").transform(() => null)),
  knownRisks: z.string().trim().max(2000).nullish().or(z.literal("").transform(() => null)),
});

export async function GET() {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  return apiOk({ projects: await listProjects(c.ctx.workspaceId) });
}

export async function POST(req: Request) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const limited = limit(`project:${c.ctx.userId}`, 30, 60 * 60_000);
  if (limited) return limited;
  const body = await parseBody(req, projectSchema);
  if (!body.ok) return body.response;
  const usage = await getUsage(c.ctx.workspaceId);
  if (usage.projects >= usage.maxProjects) {
    return apiError(402, "plan_limit", `Your ${PLANS[usage.plan].label} plan allows ${usage.maxProjects} projects. Delete one or upgrade to add more.`);
  }
  const d = body.data;
  const p = await createProject(c.ctx.workspaceId, {
    name: d.name,
    domain: d.domain,
    stage: d.stage,
    goal: d.goal,
    deadline: d.deadline ? new Date(`${d.deadline}T00:00:00Z`) : null,
    budget: d.budget || null,
    teamSize: d.teamSize ?? null,
    knownRisks: d.knownRisks || null,
  });
  return apiOk({ id: p.id }, 201);
}
