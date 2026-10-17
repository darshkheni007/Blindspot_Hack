import { z } from "zod";
import { FACTORS, sanitizeWeights, WEIGHT_RANGE } from "@/lib/analysis/scoring";
import { saveWeights } from "@/lib/data/projects";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, parseBody } from "@/lib/http";

export const runtime = "nodejs";

const w = z.number().min(WEIGHT_RANGE.min).max(WEIGHT_RANGE.max);
const schema = z.object(Object.fromEntries(FACTORS.map((f) => [f, w])) as Record<(typeof FACTORS)[number], typeof w>);

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  const ok = await saveWeights(c.ctx.workspaceId, (await params).id, sanitizeWeights(body.data));
  return ok ? apiOk({ ok: true }) : apiError(404, "not_found", "Project not found.");
}
