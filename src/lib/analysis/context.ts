import type { ChunkInfo, DocInfo, ProjectInfo } from "./types";
import type { LLMProvider } from "./providers/types";

export const PROJECT_DOC_ID = "__project__";
export const PROJECT_DOC_NAME = "Project details";

export interface DetectorContext {
  project: ProjectInfo;
  docs: DocInfo[];
  /** Includes the synthetic "Project details" chunk built from the wizard. */
  chunks: ChunkInfo[];
  provider: LLMProvider;
  now: Date;
}

const STAGE_PROXIMITY: Record<string, number> = { PRE_LAUNCH: 5, IN_PROGRESS: 4, PROPOSAL: 2 };

/** Builds a pseudo-document from the wizard's optional context so it can be cross-checked like any file. */
export function projectContextChunk(p: ProjectInfo): ChunkInfo | null {
  const lines: string[] = [];
  if (p.goal) lines.push(`Project goal: ${p.goal}`);
  if (p.deadline) lines.push(`Deadline: ${p.deadline}.`);
  if (p.budget) lines.push(`Budget: ${p.budget}.`);
  if (p.teamSize) lines.push(`Team of ${p.teamSize} people.`);
  if (p.knownRisks) lines.push(`Known risks: ${p.knownRisks}`);
  if (lines.length === 0) return null;
  return { documentId: PROJECT_DOC_ID, documentName: PROJECT_DOC_NAME, ordinal: 0, locator: "project setup", text: lines.join("\n") };
}

/** 1–5: how soon the problem will bite, from the earliest relevant date (epoch days) or the project stage. */
export function proximityFor(ctx: Pick<DetectorContext, "project" | "now">, epochDay?: number): { value: number; reason: string } {
  if (epochDay !== undefined) {
    const days = epochDay - Math.floor(ctx.now.getTime() / 86400000);
    if (days <= 0) return { value: 5, reason: "The date has already arrived or passed" };
    if (days <= 45) return { value: 5, reason: `The date is ${days} days away` };
    if (days <= 100) return { value: 4, reason: `The date is ${days} days away` };
    if (days <= 200) return { value: 3, reason: `The date is about ${Math.round(days / 30)} months away` };
    if (days <= 400) return { value: 2, reason: `The date is about ${Math.round(days / 30)} months away` };
    return { value: 1, reason: "The date is more than a year away" };
  }
  const v = STAGE_PROXIMITY[ctx.project.stage] ?? 3;
  const label = ctx.project.stage === "PRE_LAUNCH" ? "pre-launch" : ctx.project.stage === "IN_PROGRESS" ? "in progress" : "proposal";
  return { value: v, reason: `The project is at the ${label} stage and no earlier date is given` };
}

export function docNames(ctx: Pick<DetectorContext, "docs">): string[] {
  return ctx.docs.map((d) => d.name);
}

export function corpusPayload(ctx: DetectorContext) {
  return {
    project: ctx.project,
    documents: ctx.docs.map((d) => ({ name: d.name, type: d.docType })),
    chunks: ctx.chunks.map((c) => ({ documentId: c.documentId, documentName: c.documentName, ordinal: c.ordinal, locator: c.locator, text: c.text })),
  };
}
