import { prisma } from "../prisma";
import { getStorage } from "../storage";
import { sanitizeWeights, type Weights } from "../analysis/scoring";

export interface ProjectInput {
  name: string;
  domain: "SOFTWARE" | "CONSTRUCTION" | "HEALTHCARE" | "FINANCE" | "DATA_ML" | "OTHER";
  stage: "PROPOSAL" | "IN_PROGRESS" | "PRE_LAUNCH";
  goal: string;
  deadline?: Date | null;
  budget?: string | null;
  teamSize?: number | null;
  knownRisks?: string | null;
  isSample?: boolean;
}

export async function createProject(ws: string, input: ProjectInput) {
  return prisma.project.create({ data: { ...input, workspaceId: ws } });
}

export async function getProject(ws: string, id: string) {
  return prisma.project.findFirst({ where: { id, workspaceId: ws } });
}

export async function listProjects(ws: string) {
  const projects = await prisma.project.findMany({
    where: { workspaceId: ws },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });
  const groups = await prisma.finding.groupBy({
    by: ["projectId", "severity"],
    where: { workspaceId: ws, status: "OPEN", active: true },
    _count: { _all: true },
  });
  return projects.map((p) => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const g of groups) if (g.projectId === p.id) counts[g.severity] = g._count._all;
    return { ...p, documentCount: p._count.documents, openBySeverity: counts };
  });
}

export async function getProjectWeights(ws: string, id: string): Promise<Weights | null> {
  const p = await getProject(ws, id);
  return p ? sanitizeWeights(p.weights as Record<string, unknown> | null) : null;
}

export async function saveWeights(ws: string, id: string, weights: Weights) {
  const r = await prisma.project.updateMany({ where: { id, workspaceId: ws }, data: { weights } });
  return r.count > 0;
}

export async function deleteProject(ws: string, id: string): Promise<boolean> {
  const p = await getProject(ws, id);
  if (!p) return false;
  await getStorage().deletePrefix(`${ws}/${id}`);
  await prisma.project.delete({ where: { id } });
  return true;
}
