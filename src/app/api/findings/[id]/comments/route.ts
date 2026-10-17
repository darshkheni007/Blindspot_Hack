import { z } from "zod";
import { addComment } from "@/lib/data/findings";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, limit, parseBody } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({ body: z.string().trim().min(1, "Write a comment first.").max(2000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const limited = limit(`comment:${c.ctx.userId}`, 60, 10 * 60_000);
  if (limited) return limited;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  const r = await addComment(c.ctx.workspaceId, (await params).id, c.ctx.userId, body.data.body);
  return r ? apiOk({ id: r.id }, 201) : apiError(404, "not_found", "Finding not found.");
}
