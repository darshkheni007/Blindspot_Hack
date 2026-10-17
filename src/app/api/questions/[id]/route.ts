import { z } from "zod";
import { updateQuestion } from "@/lib/data/insights";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, parseBody } from "@/lib/http";

export const runtime = "nodejs";
const schema = z.object({ status: z.enum(["OPEN", "ASKED", "ANSWERED", "DROPPED"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  return (await updateQuestion(c.ctx.workspaceId, (await params).id, body.data.status)) ? apiOk({ ok: true }) : apiError(404, "not_found", "Question not found.");
}
