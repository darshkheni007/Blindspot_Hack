import { PLANS, type PlanKey } from "@/config/app";
import { prisma } from "../prisma";

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getWorkspace(ws: string) {
  return prisma.workspace.findUnique({ where: { id: ws } });
}

export async function getUsage(ws: string, now = new Date()) {
  const w = await getWorkspace(ws);
  const plan = (w?.plan ?? "FREE") as PlanKey;
  const [projects, docsThisMonth] = await Promise.all([
    prisma.project.count({ where: { workspaceId: ws } }),
    prisma.usageEvent.count({ where: { workspaceId: ws, kind: "document", createdAt: { gte: monthStart(now) } } }),
  ]);
  const limits = PLANS[plan];
  return { plan, projects, docsThisMonth, maxProjects: limits.maxProjects, maxDocsPerMonth: limits.maxDocsPerMonth };
}

export async function renameWorkspace(ws: string, name: string) {
  await prisma.workspace.update({ where: { id: ws }, data: { name } });
}

export async function recordDocumentUsage(ws: string) {
  await prisma.usageEvent.create({ data: { workspaceId: ws, kind: "document" } });
}
