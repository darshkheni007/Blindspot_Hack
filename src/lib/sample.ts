import { readFile } from "node:fs/promises";
import path from "node:path";
import { ingestDocument } from "./documents";
import { createProject } from "./data/projects";
import { getDocument, listDocuments } from "./data/documents";
import { startAnalysis } from "./analysis/service";

export const SAMPLE_FILES = ["Meridian-Billing-PRD.md", "Meridian-Migration-Plan.md", "Meridian-Budget.csv"];

/** Creates the sample "billing platform migration" project and queues its first analysis. */
export async function createSampleProject(ws: string, opts: { analyze?: boolean; now?: Date } = {}) {
  const project = await createProject(ws, {
    name: "Meridian billing migration (sample)",
    domain: "SOFTWARE",
    stage: "IN_PROGRESS",
    goal: "Move all customers from the legacy BillMaster system to a new billing platform without interrupting invoicing.",
    deadline: new Date(Date.UTC(2027, 2, 15)),
    budget: "$350,000",
    teamSize: 6,
    knownRisks: "Data migration accuracy",
    isSample: true,
  });
  for (const f of SAMPLE_FILES) {
    const buf = await readFile(path.join(process.cwd(), "prisma", "sample", f));
    await ingestDocument(ws, project.id, f, buf);
  }
  if (opts.analyze !== false) {
    // Wait for parsing, then queue analysis.
    for (let i = 0; i < 100; i++) {
      const docs = await listDocuments(ws, project.id);
      if (docs.every((d) => d.status !== "PARSING")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await startAnalysis(ws, project.id, { now: opts.now });
  }
  return project;
}

export { getDocument };
