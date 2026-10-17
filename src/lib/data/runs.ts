import { prisma } from "../prisma";

export const STEPS = [
  { id: "reading", label: "Reading documents" },
  { id: "assumptions", label: "Finding assumptions" },
  { id: "contradictions", label: "Checking contradictions" },
  { id: "ranking", label: "Ranking" },
] as const;

export interface RunDTO {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  step: string;
  stepIndex: number;
  provider: string;
  model: string;
  promptVersion: string;
  stats: { total: number; open: number; critical: number; dropped: number; cachedDocs: number } | null;
  diff: { newIds: string[]; worsenedIds: string[]; resolvedIds: string[] } | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

function toDTO(r: Awaited<ReturnType<typeof prisma.analysisRun.findFirstOrThrow>>): RunDTO {
  return {
    id: r.id,
    status: r.status,
    step: r.step,
    stepIndex: r.stepIndex,
    provider: r.provider,
    model: r.model,
    promptVersion: r.promptVersion,
    stats: r.stats as RunDTO["stats"],
    diff: r.diff as RunDTO["diff"],
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

export async function createRun(ws: string, projectId: string, meta: { provider: string; model: string; promptVersion: string; docHashes: Record<string, string> }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: ws }, select: { id: true } });
  if (!project) return null;
  const r = await prisma.analysisRun.create({
    data: { workspaceId: ws, projectId, status: "QUEUED", step: "queued", ...meta },
  });
  return toDTO(r);
}

export async function updateRun(ws: string, id: string, data: { status?: RunDTO["status"]; step?: string; stepIndex?: number; stats?: object; diff?: object; error?: string | null; finishedAt?: Date }) {
  await prisma.analysisRun.updateMany({ where: { id, workspaceId: ws }, data });
}

export async function getLatestRun(ws: string, projectId: string) {
  const r = await prisma.analysisRun.findFirst({ where: { workspaceId: ws, projectId }, orderBy: { startedAt: "desc" } });
  return r ? toDTO(r) : null;
}

export async function getActiveRun(ws: string, projectId: string) {
  const r = await prisma.analysisRun.findFirst({
    where: { workspaceId: ws, projectId, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { startedAt: "desc" },
  });
  return r ? toDTO(r) : null;
}

export async function listRuns(ws: string, projectId: string, take = 20) {
  const rs = await prisma.analysisRun.findMany({ where: { workspaceId: ws, projectId }, orderBy: { startedAt: "asc" }, take });
  return rs.map(toDTO);
}

export async function getRunDocHashes(ws: string, projectId: string): Promise<Record<string, string> | null> {
  const r = await prisma.analysisRun.findFirst({
    where: { workspaceId: ws, projectId, status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    select: { docHashes: true },
  });
  return (r?.docHashes as Record<string, string>) ?? null;
}

export async function touchProjectAnalyzed(ws: string, projectId: string) {
  await prisma.project.updateMany({ where: { id: projectId, workspaceId: ws }, data: { lastAnalyzedAt: new Date() } });
}

/** Marks runs left RUNNING/QUEUED by a crashed process as failed so the UI never spins forever. */
export async function failStaleRuns(ws: string, projectId: string, olderThanMs = 10 * 60_000) {
  await prisma.analysisRun.updateMany({
    where: { workspaceId: ws, projectId, status: { in: ["QUEUED", "RUNNING"] }, startedAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: { status: "FAILED", error: "The analysis was interrupted. Please run it again.", finishedAt: new Date() },
  });
}
