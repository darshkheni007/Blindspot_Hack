import PDFDocument from "pdfkit";
import { DOMAINS, STAGES } from "@/config/app";
import { listAssumptions, listQuestions } from "./data/insights";
import { listFindings, type FindingDTO } from "./data/findings";
import { getProject } from "./data/projects";
import { getLatestRun } from "./data/runs";
import { CATEGORY_TEXT, STATUS_TEXT, SEVERITY_TEXT } from "./labels";

export interface ReportData {
  project: { id: string; name: string; domain: string; stage: string; goal: string };
  generatedAt: string;
  run: { provider: string; model: string; promptVersion: string; finishedAt: string | null } | null;
  counts: { total: number; open: number; critical: number; high: number; reviewed: number };
  summary: string[];
  top: FindingDTO[];
  findings: FindingDTO[];
  questions: Awaited<ReturnType<typeof listQuestions>>;
  assumptions: Awaited<ReturnType<typeof listAssumptions>>;
}

/** Builds the executive summary from stored results. Plain templates, no model call, so it is reproducible. */
export async function buildReport(ws: string, projectId: string, userId: string): Promise<ReportData | null> {
  const project = await getProject(ws, projectId);
  if (!project) return null;
  const [findings, questions, assumptions, run] = await Promise.all([listFindings(ws, projectId, userId), listQuestions(ws, projectId), listAssumptions(ws, projectId), getLatestRun(ws, projectId)]);
  const open = findings.filter((f) => f.status === "OPEN");
  const critical = findings.filter((f) => f.severity === "CRITICAL" && f.status === "OPEN").length;
  const high = findings.filter((f) => f.severity === "HIGH" && f.status === "OPEN").length;
  const reviewed = findings.filter((f) => f.status !== "OPEN" && f.status !== "DEFERRED").length;
  const top = open.slice(0, 5);
  const domain = DOMAINS.find((d) => d.value === project.domain)?.label ?? project.domain;
  const stage = STAGES.find((s) => s.value === project.stage)?.label ?? project.stage;
  const contradictions = findings.filter((f) => f.category === "CONTRADICTION" && f.status === "OPEN").length;
  const absences = findings.filter((f) => f.isAbsence && f.status === "OPEN").length;
  const summary: string[] = [];
  if (findings.length === 0) {
    summary.push(`No analysis results are available yet for ${project.name}.`);
  } else {
    summary.push(`Blindspot found ${findings.length} items in the documents for ${project.name} (${domain}, ${stage.toLowerCase()}). ${open.length} are still open: ${critical} critical and ${high} high priority.`);
    if (contradictions || absences) {
      summary.push(`${contradictions} are contradictions between documents or project details. ${absences} are topics the documents never address.`);
    }
    if (top.length) {
      summary.push(`Address these first: ${top.map((f, i) => `${i + 1}) ${f.title.replace(/[.]+$/, "")}`).join("; ")}.`);
    }
    const unvalidated = assumptions.filter((a) => a.status === "UNVALIDATED").length;
    if (assumptions.length) summary.push(`The assumptions register lists ${assumptions.length} assumptions, ${unvalidated} not yet validated.`);
    summary.push(`${reviewed} of ${findings.length} findings have been reviewed.`);
  }
  return {
    project: { id: project.id, name: project.name, domain, stage, goal: project.goal },
    generatedAt: new Date().toISOString(),
    run: run ? { provider: run.provider, model: run.model, promptVersion: run.promptVersion, finishedAt: run.finishedAt } : null,
    counts: { total: findings.length, open: open.length, critical, high, reviewed },
    summary,
    top,
    findings,
    questions,
    assumptions,
  };
}

/** Neutralises spreadsheet formula injection and quotes per RFC 4180. */
export function csvCell(v: unknown): string {
  let s = String(v ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportCsv(r: ReportData): string {
  const head = ["Rank", "Title", "Category", "Severity", "Priority", "Confidence", "Status", "Status reason", "Why it matters", "Evidence", "Question to ask", "Who can answer", "Next step"];
  const rows = r.findings.map((f, i) => [
    i + 1,
    f.title,
    CATEGORY_TEXT[f.category],
    SEVERITY_TEXT[f.severity],
    f.priority,
    f.confidence.replace("_", " ").toLowerCase(),
    STATUS_TEXT[f.status],
    f.statusReason ?? "",
    f.whyItMatters,
    f.isAbsence ? `Not found in: ${f.checkedDocuments.join(", ")}` : f.evidence.map((e) => `${e.documentName} (${e.locator}): "${e.quote}"`).join(" | "),
    f.question,
    f.owner,
    f.nextStep,
  ]);
  return "﻿" + [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function reportPdf(r: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `${r.project.name} - Blindspot report` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const gray = "#52525b";
    doc.fontSize(20).fillColor("#18181b").text(r.project.name);
    doc.moveDown(0.2).fontSize(10).fillColor(gray).text(`${r.project.domain} · ${r.project.stage} · Generated ${r.generatedAt.slice(0, 10)}`);
    if (r.run) doc.text(`Model: ${r.run.model} · Prompt version: ${r.run.promptVersion}`);
    doc.moveDown().fontSize(13).fillColor("#18181b").text("Executive summary");
    doc.moveDown(0.3).fontSize(10.5).fillColor("#27272a");
    for (const p of r.summary) doc.text(p, { paragraphGap: 6 });
    doc.moveDown().fontSize(13).fillColor("#18181b").text("Findings, ranked");
    r.findings.forEach((f, i) => {
      doc.moveDown(0.6).fontSize(11).fillColor("#18181b").text(`${i + 1}. ${f.title}`, { continued: false });
      doc.fontSize(9).fillColor(gray).text(`${SEVERITY_TEXT[f.severity]} · priority ${f.priority}/100 · ${CATEGORY_TEXT[f.category]} · ${STATUS_TEXT[f.status]}`);
      doc.fontSize(10).fillColor("#27272a").text(f.whyItMatters);
      if (f.isAbsence) doc.fillColor(gray).text(`Not found in provided materials. Checked: ${f.checkedDocuments.join(", ") || "all documents"}.`);
      for (const e of f.evidence.slice(0, 3)) doc.fillColor(gray).fontSize(9).text(`“${e.quote}” — ${e.documentName}, ${e.locator}`, { indent: 10 });
      doc.fillColor("#27272a").fontSize(10).text(`Ask: ${f.question} (${f.owner})`);
    });
    if (r.questions.length) {
      doc.addPage().fontSize(13).fillColor("#18181b").text("Questions you haven't asked");
      doc.moveDown(0.4).fontSize(10).fillColor("#27272a");
      r.questions.forEach((q, i) => doc.text(`${i + 1}. ${q.text}  [${q.suggestedOwner}]`, { paragraphGap: 4 }));
    }
    if (r.assumptions.length) {
      doc.moveDown().fontSize(13).fillColor("#18181b").text("Assumptions register");
      doc.moveDown(0.4).fontSize(10).fillColor("#27272a");
      r.assumptions.forEach((a, i) => doc.text(`${i + 1}. ${a.statement}  [${a.status.toLowerCase()}] Risk if false: ${a.riskIfFalse}`, { paragraphGap: 4 }));
    }
    doc.end();
  });
}
