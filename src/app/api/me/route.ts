import { z } from "zod";
import { deleteAllUserData, getUserProfile, updateProfile } from "@/lib/data/users";
import { apiCtx } from "@/lib/data/session";
import { apiError, apiOk, parseBody } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  return apiOk({ profile: await getUserProfile(c.ctx.userId) });
}

const patch = z.object({ name: z.string().trim().min(1, "Enter your name.").max(80) });
export async function PATCH(req: Request) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const body = await parseBody(req, patch);
  if (!body.ok) return body.response;
  await updateProfile(c.ctx.userId, body.data);
  return apiOk({ ok: true });
}

/** Delete everything: files, rows, workspace and the account. The client must confirm by typing the email. */
const del = z.object({ confirmEmail: z.string() });
export async function DELETE(req: Request) {
  const c = await apiCtx();
  if (!c.ok) return c.response;
  const body = await parseBody(req, del);
  if (!body.ok) return body.response;
  if (body.data.confirmEmail.trim().toLowerCase() !== c.ctx.email.toLowerCase()) {
    return apiError(422, "confirm_mismatch", "Type your email address exactly to confirm.", { fieldErrors: { confirmEmail: ["That doesn't match your email."] } });
  }
  await deleteAllUserData(c.ctx.userId, c.ctx.workspaceId);
  return apiOk({ ok: true });
}
