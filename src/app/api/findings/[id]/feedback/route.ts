import { z } from "zod";
import { setFeedback } from "@/lib/data/findings";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, parseBody } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ kind: z.enum(["USEFUL", "NOT_USEFUL", "WRONG", "DUPLICATE"]) });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  const ok = await setFeedback(c.ctx.workspaceId, (await params).id, c.ctx.userId, body.data.kind);
  return ok ? apiOk({ ok: true }) : apiError(404, "not_found", "Finding not found.");
}
