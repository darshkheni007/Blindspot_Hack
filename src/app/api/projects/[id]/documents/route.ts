import { listDocuments } from "@/lib/data/documents";
import { getProject } from "@/lib/data/projects";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, limit } from "@/lib/http";
import { ingestDocument, UploadError } from "@/lib/documents";
import { UPLOAD } from "@/config/app";

export const runtime = "nodejs";
type P = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const id = (await params).id;
  if (!(await getProject(c.ctx.workspaceId, id))) return apiError(404, "not_found", "Project not found.");
  const docs = await listDocuments(c.ctx.workspaceId, id);
  return apiOk({ documents: docs.map(docDTO) });
}

export function docDTO(d: Awaited<ReturnType<typeof listDocuments>>[number]) {
  return {
    id: d.id,
    name: d.name,
    ext: d.ext,
    sizeBytes: d.sizeBytes,
    docType: d.docType,
    status: d.status,
    error: d.error,
    pageCount: d.pageCount,
    chunkCount: d._count.chunks,
    createdAt: d.createdAt.toISOString(),
  };
}

/** One file per request, so the browser can show per-file progress and failures. */
export async function POST(req: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const limited = limit(`upload:${c.ctx.userId}`, 60, 10 * 60_000);
  if (limited) return limited;
  const id = (await params).id;
  if (!(await getProject(c.ctx.workspaceId, id))) return apiError(404, "not_found", "Project not found.");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > UPLOAD.maxBytes + 64 * 1024) return apiError(413, "too_large", "That file is larger than 25 MB.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "invalid_form", "Upload a file as multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return apiError(422, "validation_error", "Choose a file to upload.");
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const r = await ingestDocument(c.ctx.workspaceId, id, file.name, buf);
    return apiOk({ id: r.document.id, unchanged: r.unchanged }, r.unchanged ? 200 : 201);
  } catch (e) {
    if (e instanceof UploadError) return apiError(e.status, e.code, e.message);
    return apiError(500, "upload_failed", "We couldn't save that file. Try again.");
  }
}
