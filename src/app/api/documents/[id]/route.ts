import { z } from "zod";
import { DOC_TYPES } from "@/config/app";
import { deleteDocument, getChunksForDocument, getDocument, updateDocType } from "@/lib/data/documents";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, parseBody } from "@/lib/http";

export const runtime = "nodejs";
type P = { params: Promise<{ id: string }> };

/** Extraction preview: the chunks we pulled out, with their locators. Contents are never logged. */
export async function GET(_: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const id = (await params).id;
  const d = await getDocument(c.ctx.workspaceId, id);
  if (!d) return apiError(404, "not_found", "Document not found.");
  const chunks = await getChunksForDocument(c.ctx.workspaceId, id);
  return apiOk({ name: d.name, status: d.status, chunks: chunks.map((k) => ({ id: k.id, locator: k.locator, text: k.text })) });
}

const patch = z.object({ docType: z.enum(DOC_TYPES) });
export async function PATCH(req: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const body = await parseBody(req, patch);
  if (!body.ok) return body.response;
  const ok = await updateDocType(c.ctx.workspaceId, (await params).id, body.data.docType);
  return ok ? apiOk({ ok: true }) : apiError(404, "not_found", "Document not found.");
}

export async function DELETE(_: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const ok = await deleteDocument(c.ctx.workspaceId, (await params).id);
  return ok ? apiOk({ ok: true }) : apiError(404, "not_found", "Document not found.");
}
