import { prisma } from "../prisma";
import type { Evidence } from "../analysis/types";
import { severityFor, type SeverityKey } from "../analysis/scoring";

export type FindingStatusKey = "OPEN" | "ACCEPTED" | "REJECTED" | "DEFERRED" | "ALREADY_KNOWN";
export type FeedbackKindKey = "USEFUL" | "NOT_USEFUL" | "WRONG" | "DUPLICATE";

export interface FindingDTO {
  id: string;
  projectId: string;
  title: string;
  category: "ASSUMPTION" | "CONSTRAINT" | "QUESTION" | "CONTRADICTION" | "DATA_ISSUE";
  whyItMatters: string;
  evidence: Evidence[];
  isAbsence: boolean;
  checkedDocuments: string[];
  confidence: "EVIDENCE_BACKED" | "INFERRED" | "PATTERN_BASED";
  factors: { impact: number; likelihood: number; irreversibility: number; proximity: number; cost: number };
  justifications: { impact: string; likelihood: string; irreversibility: string; proximity: string; cost: string };
  priority: number;
  previousPriority: number | null;
  severity: SeverityKey;
  disproof: string;
  question: string;
  owner: string;
  nextStep: string;
  status: FindingStatusKey;
  statusReason: string | null;
  diffState: string;
  active: boolean;
  groupKey: string | null;
  detector: string;
  createdAt: string;
  updatedAt: string;
  myFeedback: FeedbackKindKey | null;
  commentCount: number;
}

type Row = Awaited<ReturnType<typeof prisma.finding.findFirstOrThrow>> & {
  feedback?: Array<{ kind: FeedbackKindKey }>;
  _count?: { comments: number };
};

export function toDTO(r: Row): FindingDTO {
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    category: r.category,
    whyItMatters: r.whyItMatters,
    evidence: (r.evidence as unknown as Evidence[]) ?? [],
    isAbsence: r.isAbsence,
    checkedDocuments: (r.checkedDocuments as unknown as string[]) ?? [],
    confidence: r.confidence,
    factors: { impact: r.impact, likelihood: r.likelihood, irreversibility: r.irreversibility, proximity: r.proximity, cost: r.cost },
    justifications: r.justifications as FindingDTO["justifications"],
    priority: r.priority,
    previousPriority: r.previousPriority,
    severity: r.severity,
    disproof: r.disproof,
    question: r.question,
    owner: r.owner,
    nextStep: r.nextStep,
    status: r.status,
    statusReason: r.statusReason,
    diffState: r.diffState,
    active: r.active,
    groupKey: r.groupKey,
    detector: r.detector,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    myFeedback: r.feedback?.[0]?.kind ?? null,
    commentCount: r._count?.comments ?? 0,
  };
}

export async function listFindings(ws: string, projectId: string, userId: string, opts: { includeResolved?: boolean } = {}) {
  const rows = await prisma.finding.findMany({
    where: { workspaceId: ws, projectId, ...(opts.includeResolved ? {} : { active: true }) },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: { feedback: { where: { userId }, select: { kind: true } }, _count: { select: { comments: true } } },
  });
  return rows.map((r) => toDTO(r as Row));
}

export async function getFinding(ws: string, id: string, userId: string) {
  const r = await prisma.finding.findFirst({
    where: { id, workspaceId: ws },
    include: { feedback: { where: { userId }, select: { kind: true } }, _count: { select: { comments: true } } },
  });
  return r ? toDTO(r as Row) : null;
}

export async function listComments(ws: string, findingId: string) {
  const rows = await prisma.findingComment.findMany({
    where: { workspaceId: ws, findingId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return rows.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), author: c.user.name || c.user.email }));
}

export async function updateFindingStatus(ws: string, id: string, status: FindingStatusKey, reason: string | null) {
  const r = await prisma.finding.updateMany({ where: { id, workspaceId: ws }, data: { status, statusReason: reason } });
  return r.count > 0;
}

export async function addComment(ws: string, findingId: string, userId: string, body: string) {
  const f = await prisma.finding.findFirst({ where: { id: findingId, workspaceId: ws }, select: { id: true } });
  if (!f) return null;
  return prisma.findingComment.create({ data: { workspaceId: ws, findingId, userId, body } });
}

export async function setFeedback(ws: string, findingId: string, userId: string, kind: FeedbackKindKey) {
  const f = await prisma.finding.findFirst({ where: { id: findingId, workspaceId: ws }, select: { id: true } });
  if (!f) return false;
  await prisma.findingFeedback.upsert({
    where: { findingId_userId: { findingId, userId } },
    create: { workspaceId: ws, findingId, userId, kind },
    update: { kind },
  });
  return true;
}

export interface ScoredFinding {
  fingerprint: string;
  groupKey: string | null;
  detector: string;
  title: string;
  category: FindingDTO["category"];
  whyItMatters: string;
  evidence: Evidence[];
  isAbsence: boolean;
  checkedDocuments: string[];
  confidence: FindingDTO["confidence"];
  factors: FindingDTO["factors"];
  justifications: FindingDTO["justifications"];
  priority: number;
  disproof: string;
  question: string;
  owner: string;
  nextStep: string;
  verifier: unknown;
}

/** Inserts or updates a finding (by stable fingerprint) and reports how it changed since last run. */
export async function upsertAnalysisFinding(ws: string, projectId: string, runId: string, f: ScoredFinding) {
  const existing = await prisma.finding.findUnique({ where: { projectId_fingerprint: { projectId, fingerprint: f.fingerprint } } });
  if (existing && existing.workspaceId !== ws) throw new Error("tenant mismatch");
  const data = {
    runId,
    groupKey: f.groupKey,
    detector: f.detector,
    title: f.title,
    category: f.category,
    whyItMatters: f.whyItMatters,
    evidence: f.evidence as object,
    isAbsence: f.isAbsence,
    checkedDocuments: f.checkedDocuments as object,
    confidence: f.confidence,
    impact: f.factors.impact,
    likelihood: f.factors.likelihood,
    irreversibility: f.factors.irreversibility,
    proximity: f.factors.proximity,
    cost: f.factors.cost,
    justifications: f.justifications as object,
    priority: f.priority,
    severity: severityFor(f.priority),
    disproof: f.disproof,
    question: f.question,
    owner: f.owner,
    nextStep: f.nextStep,
    verifier: (f.verifier ?? {}) as object,
    active: true,
  };
  if (!existing) {
    const created = await prisma.finding.create({
      data: { ...data, workspaceId: ws, projectId, firstRunId: runId, fingerprint: f.fingerprint, diffState: "NEW" },
    });
    return { id: created.id, state: "NEW" as const };
  }
  const worsened = f.priority >= existing.priority + 10;
  const reappeared = !existing.active;
  const state = reappeared ? "NEW" : worsened ? "WORSENED" : "UNCHANGED";
  await prisma.finding.update({ where: { id: existing.id }, data: { ...data, previousPriority: existing.priority, diffState: state } });
  return { id: existing.id, state: state as "NEW" | "WORSENED" | "UNCHANGED" };
}

/** Marks findings that the latest run no longer produced as resolved-by-rerun. */
export async function resolveUnseen(ws: string, projectId: string, runId: string) {
  const unseen = await prisma.finding.findMany({
    where: { workspaceId: ws, projectId, active: true, NOT: { runId } },
    select: { id: true },
  });
  if (unseen.length) {
    await prisma.finding.updateMany({
      where: { id: { in: unseen.map((u) => u.id) } },
      data: { active: false, diffState: "RESOLVED" },
    });
  }
  return unseen.map((u) => u.id);
}

export async function countStats(ws: string, projectId: string) {
  const rows = await prisma.finding.findMany({
    where: { workspaceId: ws, projectId, active: true },
    select: { status: true, severity: true },
  });
  const open = rows.filter((r) => r.status === "OPEN").length;
  const critical = rows.filter((r) => r.status === "OPEN" && r.severity === "CRITICAL").length;
  const reviewed = rows.filter((r) => ["ACCEPTED", "REJECTED", "ALREADY_KNOWN"].includes(r.status)).length;
  return { total: rows.length, open, critical, reviewed, resolvedPct: rows.length ? Math.round((reviewed / rows.length) * 100) : 0 };
}
