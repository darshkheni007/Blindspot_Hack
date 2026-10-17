import { prisma } from "../prisma";
import type { AssumptionCandidate, QuestionCandidate } from "../analysis/types";

export type AssumptionStatusKey = "UNVALIDATED" | "VALIDATED" | "INVALID";
export type QuestionStatusKey = "OPEN" | "ASKED" | "ANSWERED" | "DROPPED";

export async function syncAssumptions(ws: string, projectId: string, items: AssumptionCandidate[]) {
  const seen = new Set<string>();
  for (const a of items) {
    seen.add(a.key);
    await prisma.assumption.upsert({
      where: { projectId_fingerprint: { projectId, fingerprint: a.key } },
      create: { workspaceId: ws, projectId, fingerprint: a.key, statement: a.statement, sourceDoc: a.sourceDoc, sourceLocator: a.sourceLocator, sourceQuote: a.sourceQuote, riskIfFalse: a.riskIfFalse },
      update: { statement: a.statement, sourceDoc: a.sourceDoc, sourceLocator: a.sourceLocator, sourceQuote: a.sourceQuote, riskIfFalse: a.riskIfFalse, active: true },
    });
  }
  await prisma.assumption.updateMany({ where: { workspaceId: ws, projectId, fingerprint: { notIn: [...seen] } }, data: { active: false } });
}

export async function listAssumptions(ws: string, projectId: string) {
  const rows = await prisma.assumption.findMany({ where: { workspaceId: ws, projectId, active: true }, orderBy: { createdAt: "asc" } });
  return rows.map((a) => ({ id: a.id, statement: a.statement, sourceDoc: a.sourceDoc, sourceLocator: a.sourceLocator, sourceQuote: a.sourceQuote, riskIfFalse: a.riskIfFalse, status: a.status as AssumptionStatusKey }));
}

export async function updateAssumption(ws: string, id: string, status: AssumptionStatusKey) {
  const r = await prisma.assumption.updateMany({ where: { id, workspaceId: ws }, data: { status } });
  return r.count > 0;
}

export async function syncQuestions(ws: string, projectId: string, items: Array<QuestionCandidate & { findingId?: string | null }>) {
  const seen = new Set<string>();
  for (const q of items) {
    seen.add(q.key);
    await prisma.question.upsert({
      where: { projectId_fingerprint: { projectId, fingerprint: q.key } },
      create: { workspaceId: ws, projectId, fingerprint: q.key, text: q.text, suggestedOwner: q.suggestedOwner, findingId: q.findingId ?? null },
      update: { text: q.text, suggestedOwner: q.suggestedOwner, findingId: q.findingId ?? null, active: true },
    });
  }
  await prisma.question.updateMany({ where: { workspaceId: ws, projectId, fingerprint: { notIn: [...seen] } }, data: { active: false } });
}

export async function listQuestions(ws: string, projectId: string) {
  const rows = await prisma.question.findMany({ where: { workspaceId: ws, projectId, active: true }, orderBy: { createdAt: "asc" } });
  const ids = rows.map((r) => r.findingId).filter((x): x is string => Boolean(x));
  const fs = ids.length
    ? await prisma.finding.findMany({ where: { workspaceId: ws, id: { in: ids } }, select: { id: true, priority: true, severity: true, title: true } })
    : [];
  const byId = new Map(fs.map((f) => [f.id, f]));
  return rows
    .map((q) => ({
      id: q.id,
      text: q.text,
      suggestedOwner: q.suggestedOwner,
      status: q.status as QuestionStatusKey,
      findingId: q.findingId,
      findingTitle: q.findingId ? byId.get(q.findingId)?.title ?? null : null,
      priority: q.findingId ? byId.get(q.findingId)?.priority ?? 0 : 0,
      severity: q.findingId ? byId.get(q.findingId)?.severity ?? "LOW" : "LOW",
    }))
    .sort((a, b) => b.priority - a.priority);
}

export async function updateQuestion(ws: string, id: string, status: QuestionStatusKey) {
  const r = await prisma.question.updateMany({ where: { id, workspaceId: ws }, data: { status } });
  return r.count > 0;
}
