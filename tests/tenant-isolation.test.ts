import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Mods = {
  prisma: typeof import("@/lib/prisma").prisma;
  users: typeof import("@/lib/data/users");
  projects: typeof import("@/lib/data/projects");
  docs: typeof import("@/lib/data/documents");
  findings: typeof import("@/lib/data/findings");
  insights: typeof import("@/lib/data/insights");
  runs: typeof import("@/lib/data/runs");
  documents: typeof import("@/lib/documents");
  storage: typeof import("@/lib/storage");
};
let m: Mods;
let A: { ws: string; user: string; project: string; doc: string; finding: string; assumption: string; question: string };
let B: { ws: string; user: string; project: string };

beforeAll(async () => {
  m = {
    prisma: (await import("@/lib/prisma")).prisma,
    users: await import("@/lib/data/users"),
    projects: await import("@/lib/data/projects"),
    docs: await import("@/lib/data/documents"),
    findings: await import("@/lib/data/findings"),
    insights: await import("@/lib/data/insights"),
    runs: await import("@/lib/data/runs"),
    documents: await import("@/lib/documents"),
    storage: await import("@/lib/storage"),
  };
  const tag = Date.now();
  const make = async (n: string) => {
    const { user, workspaceId } = await m.users.createUserWithWorkspace({ email: `${n}${tag}@iso.test`, name: n, passwordHash: null });
    const p = await m.projects.createProject(workspaceId, { name: `${n} project`, domain: "SOFTWARE", stage: "IN_PROGRESS", goal: "Test goal for isolation" });
    return { ws: workspaceId, user: user.id, project: p.id };
  };
  const a = await make("alice");
  B = await make("bob");
  const up = await m.documents.ingestDocument(a.ws, a.project, "secret-plan.md", Buffer.from("# Secret\n\nGo-live is 1 May 2027."));
  const { getQueue } = await import("@/lib/queue");
  await getQueue().idle();
  const run = await m.runs.createRun(a.ws, a.project, { provider: "mock", model: "mock", promptVersion: "v1", docHashes: {} });
  const f = await m.prisma.finding.create({
    data: {
      workspaceId: a.ws, projectId: a.project, runId: run!.id, firstRunId: run!.id, fingerprint: "fp1", detector: "t", category: "ASSUMPTION", title: "Secret finding title for alice",
      whyItMatters: "Because", evidence: [], checkedDocuments: [], confidence: "INFERRED", impact: 3, likelihood: 3, irreversibility: 3, proximity: 3, cost: 3,
      justifications: {}, priority: 50, severity: "LOW", disproof: "x", question: "q", owner: "o", nextStep: "n",
    },
  });
  const as = await m.prisma.assumption.create({ data: { workspaceId: a.ws, projectId: a.project, fingerprint: "a1", statement: "s", sourceDoc: "d", sourceLocator: "l", sourceQuote: "q", riskIfFalse: "r" } });
  const q = await m.prisma.question.create({ data: { workspaceId: a.ws, projectId: a.project, fingerprint: "q1", text: "t", suggestedOwner: "o" } });
  A = { ...a, doc: up.document.id, finding: f.id, assumption: as.id, question: q.id };
});

afterAll(async () => {
  for (const x of [A, B]) if (x) await m.prisma.workspace.deleteMany({ where: { id: x.ws } }).catch(() => {});
  await m.prisma.$disconnect();
});

describe("cross-tenant access is impossible through the data layer", () => {
  it("projects", async () => {
    expect(await m.projects.getProject(B.ws, A.project)).toBeNull();
    expect((await m.projects.listProjects(B.ws)).map((p) => p.id)).not.toContain(A.project);
    expect(await m.projects.saveWeights(B.ws, A.project, { impact: 2, likelihood: 1, irreversibility: 1, proximity: 1, cost: 1 })).toBe(false);
    expect(await m.projects.deleteProject(B.ws, A.project)).toBe(false);
    expect(await m.projects.getProject(A.ws, A.project)).not.toBeNull();
  });
  it("documents and their text", async () => {
    expect(await m.docs.getDocument(B.ws, A.doc)).toBeNull();
    expect(await m.docs.listDocuments(B.ws, A.project)).toHaveLength(0);
    expect(await m.docs.getChunksForDocument(B.ws, A.doc)).toHaveLength(0);
    expect(await m.docs.updateDocType(B.ws, A.doc, "Budget")).toBe(false);
    expect(await m.docs.deleteDocument(B.ws, A.doc)).toBe(false);
    expect(await m.docs.getDocument(A.ws, A.doc)).not.toBeNull();
  });
  it("uploading into another workspace's project is refused", async () => {
    await expect(m.documents.ingestDocument(B.ws, A.project, "x.md", Buffer.from("# hi\n\ntext"))).rejects.toThrow();
    expect(await m.docs.listDocuments(A.ws, A.project)).toHaveLength(1);
  });
  it("findings, comments and feedback", async () => {
    expect(await m.findings.getFinding(B.ws, A.finding, B.user)).toBeNull();
    expect(await m.findings.listFindings(B.ws, A.project, B.user)).toHaveLength(0);
    expect(await m.findings.updateFindingStatus(B.ws, A.finding, "REJECTED", "nope")).toBe(false);
    expect(await m.findings.addComment(B.ws, A.finding, B.user, "hi")).toBeNull();
    expect(await m.findings.setFeedback(B.ws, A.finding, B.user, "USEFUL")).toBe(false);
    const own = await m.findings.getFinding(A.ws, A.finding, A.user);
    expect(own?.status).toBe("OPEN");
  });
  it("assumptions, questions, runs and counts", async () => {
    expect(await m.insights.updateAssumption(B.ws, A.assumption, "INVALID")).toBe(false);
    expect(await m.insights.updateQuestion(B.ws, A.question, "DROPPED")).toBe(false);
    expect(await m.insights.listAssumptions(B.ws, A.project)).toHaveLength(0);
    expect(await m.insights.listQuestions(B.ws, A.project)).toHaveLength(0);
    expect(await m.runs.getLatestRun(B.ws, A.project)).toBeNull();
    expect((await m.findings.countStats(B.ws, A.project)).total).toBe(0);
    expect((await m.findings.countStats(A.ws, A.project)).total).toBe(1);
  });
});

describe("storage isolation and deletion", () => {
  it("keys are prefixed by workspace and traversal is refused", async () => {
    const d = await m.docs.getDocument(A.ws, A.doc);
    expect(d!.storageKey.startsWith(`${A.ws}/${A.project}/`)).toBe(true);
    const s = m.storage.getStorage();
    await expect(s.get(`${A.ws}/../${B.ws}/x`)).rejects.toThrow();
    await expect(s.put("../escape.txt", Buffer.from("x"), "text/plain")).rejects.toThrow();
  });
  it("deleting a project removes its files and rows, and nothing else", async () => {
    const d = await m.docs.getDocument(A.ws, A.doc);
    const s = m.storage.getStorage();
    await expect(s.get(d!.storageKey)).resolves.toBeInstanceOf(Buffer);
    expect(await m.projects.deleteProject(A.ws, A.project)).toBe(true);
    await expect(s.get(d!.storageKey)).rejects.toThrow();
    expect(await m.prisma.finding.count({ where: { projectId: A.project } })).toBe(0);
    expect(await m.prisma.chunk.count({ where: { documentId: A.doc } })).toBe(0);
    expect(await m.projects.getProject(B.ws, B.project)).not.toBeNull();
  });
  it("delete-all-my-data removes the workspace, its files and the user", async () => {
    await m.users.deleteAllUserData(B.user, B.ws);
    expect(await m.prisma.workspace.count({ where: { id: B.ws } })).toBe(0);
    expect(await m.prisma.user.count({ where: { id: B.user } })).toBe(0);
    expect(await m.prisma.project.count({ where: { workspaceId: B.ws } })).toBe(0);
  });
});
