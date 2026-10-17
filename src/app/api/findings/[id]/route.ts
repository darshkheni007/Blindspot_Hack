import { z } from "zod";
import { getFinding, listComments, updateFindingStatus } from "@/lib/data/findings";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, parseBody } from "@/lib/http";

export const runtime = "nodejs";
type P = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const id = (await params).id;
  const f = await getFinding(c.ctx.workspaceId, id, c.ctx.userId);
  if (!f) return apiError(404, "not_found", "Finding not found.");
  return apiOk({ finding: f, comments: await listComments(c.ctx.workspaceId, id) });
}

const schema = z
  .object({
    status: z.enum(["OPEN", "ACCEPTED", "REJECTED", "DEFERRED", "ALREADY_KNOWN"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => !["REJECTED", "ALREADY_KNOWN"].includes(v.status) || (v.reason && v.reason.length >= 3), {
    path: ["reason"],
    message: "Add a short reason.",
  });

export async function PATCH(req: Request, { params }: P) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  const reason = ["REJECTED", "ALREADY_KNOWN"].includes(body.data.status) ? (body.data.reason ?? null) : (body.data.reason || null);
  const ok = await updateFindingStatus(c.ctx.workspaceId, (await params).id, body.data.status, reason);
  return ok ? apiOk({ ok: true }) : apiError(404, "not_found", "Finding not found.");
}
