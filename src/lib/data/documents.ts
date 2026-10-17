import { prisma } from "../prisma";
import { getStorage } from "../storage";
import type { ChunkInfo } from "../analysis/types";

export async function createDocument(
  ws: string,
  projectId: string,
  data: { name: string; mimeType: string; ext: string; sizeBytes: number; storageKey: string; contentHash: string; docType: string },
) {
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: ws }, select: { id: true } });
  if (!project) return null;
  return prisma.document.create({ data: { ...data, workspaceId: ws, projectId, status: "PARSING" } });
}

export async function updateDocumentId(ws: string, id: string, data: { storageKey: string }) {
  await prisma.document.updateMany({ where: { id, workspaceId: ws }, data });
}

export async function listDocuments(ws: string, projectId: string) {
  return prisma.document.findMany({
    where: { workspaceId: ws, projectId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { chunks: true } } },
  });
}

export async function getDocument(ws: string, id: string) {
  return prisma.document.findFirst({ where: { id, workspaceId: ws } });
}

export async function setDocumentParsed(
  ws: string,
  id: string,
  result: { chunks: Array<{ locator: string; text: string }>; pageCount?: number },
) {
  const doc = await getDocument(ws, id);
  if (!doc) return;
  await prisma.$transaction([
    prisma.chunk.deleteMany({ where: { documentId: id, workspaceId: ws } }),
    prisma.chunk.createMany({
      data: result.chunks.map((c, i) => ({ workspaceId: ws, projectId: doc.projectId, documentId: id, ordinal: i, locator: c.locator, text: c.text })),
    }),
    prisma.document.update({ where: { id }, data: { status: "READY", error: null, pageCount: result.pageCount ?? null } }),
  ]);
}

export async function setDocumentFailed(ws: string, id: string, error: string) {
  await prisma.document.updateMany({ where: { id, workspaceId: ws }, data: { status: "FAILED", error } });
}

export async function getChunksForDocument(ws: string, id: string, limit = 400) {
  return prisma.chunk.findMany({ where: { documentId: id, workspaceId: ws }, orderBy: { ordinal: "asc" }, take: limit });
}

/** All chunks of READY documents in a project, in document then reading order. */
export async function getProjectCorpus(ws: string, projectId: string): Promise<{
  docs: Array<{ id: string; name: string; docType: string; contentHash: string }>;
  chunks: ChunkInfo[];
}> {
  const docs = await prisma.document.findMany({
    where: { workspaceId: ws, projectId, status: "READY" },
    orderBy: { createdAt: "asc" },
    include: { chunks: { orderBy: { ordinal: "asc" } } },
  });
  return {
    docs: docs.map((d) => ({ id: d.id, name: d.name, docType: d.docType, contentHash: d.contentHash })),
    chunks: docs.flatMap((d) =>
      d.chunks.map((c) => ({ documentId: d.id, documentName: d.name, ordinal: c.ordinal, locator: c.locator, text: c.text })),
    ),
  };
}

export async function updateDocType(ws: string, id: string, docType: string) {
  const r = await prisma.document.updateMany({ where: { id, workspaceId: ws }, data: { docType } });
  return r.count > 0;
}

export async function deleteDocument(ws: string, id: string): Promise<boolean> {
  const doc = await getDocument(ws, id);
  if (!doc) return false;
  await getStorage().delete(doc.storageKey);
  await prisma.document.delete({ where: { id } });
  return true;
}

export async function replaceDocumentContent(
  ws: string,
  id: string,
  data: { mimeType: string; ext: string; sizeBytes: number; storageKey: string; contentHash: string },
) {
  await prisma.document.updateMany({ where: { id, workspaceId: ws }, data: { ...data, status: "PARSING", error: null } });
}

export async function findDocumentByName(ws: string, projectId: string, name: string) {
  return prisma.document.findFirst({ where: { workspaceId: ws, projectId, name } });
}

export async function getDetectorCache(ws: string, documentId: string, detector: string, key: string): Promise<unknown | null> {
  const doc = await prisma.document.findFirst({ where: { id: documentId, workspaceId: ws }, select: { id: true } });
  if (!doc) return null;
  const row = await prisma.detectorCache.findUnique({ where: { documentId_detector_key: { documentId, detector, key } } });
  return row?.payload ?? null;
}

export async function putDetectorCache(ws: string, documentId: string, detector: string, key: string, payload: object) {
  const doc = await prisma.document.findFirst({ where: { id: documentId, workspaceId: ws }, select: { id: true } });
  if (!doc) return;
  await prisma.detectorCache.upsert({
    where: { documentId_detector_key: { documentId, detector, key } },
    create: { workspaceId: ws, documentId, detector, key, payload },
    update: { payload },
  });
}
