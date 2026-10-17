import { z } from "zod";
import { renameWorkspace } from "@/lib/data/workspaces";
import { apiCtx } from "@/lib/data/session";
import { apiOk, parseBody } from "@/lib/http";

export const runtime = "nodejs";
const patch = z.object({ name: z.string().trim().min(1, "Enter a workspace name.").max(80) });

export async function PATCH(req: Request) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const body = await parseBody(req, patch);
  if (!body.ok) return body.response;
  await renameWorkspace(c.ctx.workspaceId, body.data.name);
  return apiOk({ ok: true });
}
