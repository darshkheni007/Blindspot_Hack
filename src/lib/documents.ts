import { randomUUID } from "node:crypto";
import { PLANS } from "@/config/app";
import { createDocument, deleteDocument, findDocumentByName, replaceDocumentContent, setDocumentFailed, setDocumentParsed } from "./data/documents";
import { getUsage, recordDocumentUsage } from "./data/workspaces";
import { getQueue } from "./queue";
import { guessDocType, parseDocument, sha256, validateUpload, UnsupportedFileError } from "./parsing";
import { getStorage, storageKey } from "./storage";

export class UploadError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
};

/**
 * Validates, stores and registers an upload, then parses it in the background queue so the request
 * returns immediately. Re-uploading unchanged content is a no-op (parse cache); changed content with
 * the same name replaces the document and is re-parsed.
 */
export async function ingestDocument(ws: string, projectId: string, name: string, buf: Buffer) {
  let ext: string;
  try {
    ({ ext } = validateUpload(name, buf.length, buf.subarray(0, 8)));
  } catch (e) {
    if (e instanceof UnsupportedFileError) throw new UploadError(e.message, 415, "unsupported_file");
    throw e;
  }
  const hash = sha256(buf);
  const existing = await findDocumentByName(ws, projectId, name);
  if (existing && existing.contentHash === hash && existing.status === "READY") {
    return { document: existing, unchanged: true };
  }

  if (!existing) {
    const usage = await getUsage(ws);
    if (usage.docsThisMonth >= PLANS[usage.plan].maxDocsPerMonth) {
      throw new UploadError(`Your ${PLANS[usage.plan].label} plan allows ${PLANS[usage.plan].maxDocsPerMonth} documents per month. Upgrade to add more.`, 402, "plan_limit");
    }
  }

  const id = existing?.id ?? randomUUID();
  const key = storageKey(ws, projectId, id, name);
  await getStorage().put(key, buf, MIME[ext] ?? "application/octet-stream");
  let doc;
  if (existing) {
    if (existing.storageKey !== key) await getStorage().delete(existing.storageKey);
    await replaceDocumentContent(ws, existing.id, { mimeType: MIME[ext], ext, sizeBytes: buf.length, storageKey: key, contentHash: hash });
    doc = { ...existing, status: "PARSING" as const, contentHash: hash };
  } else {
    doc = await createDocument(ws, projectId, { name, mimeType: MIME[ext], ext, sizeBytes: buf.length, storageKey: key, contentHash: hash, docType: guessDocType(name, ext) });
    if (!doc) {
      await getStorage().delete(key);
      throw new UploadError("Project not found.", 404, "not_found");
    }
    await recordDocumentUsage(ws);
  }
  const docId = doc.id;
  getQueue().enqueue({
    id: `parse:${docId}`,
    key: `parse:${docId}`,
    run: async () => {
      try {
        const parsed = await parseDocument(buf, ext);
        if (parsed.chunks.length === 0) throw new Error("empty");
        await setDocumentParsed(ws, docId, parsed);
      } catch (e) {
        const msg = (e as Error).message === "empty" ? "No readable text was found in this file." : "This file could not be read. It may be corrupted or password-protected.";
        await setDocumentFailed(ws, docId, msg);
      }
    },
  });
  return { document: doc, unchanged: false };
}

export { deleteDocument };
