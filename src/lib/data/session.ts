import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { apiError } from "../http";

export interface Ctx {
  userId: string;
  workspaceId: string;
  email: string;
}

/** For server components/pages: redirects to sign-in when there is no valid session. */
export async function requireCtx(): Promise<Ctx> {
  const s = await auth();
  if (!s?.user?.id || !s.workspaceId) redirect("/sign-in");
  return { userId: s.user.id, workspaceId: s.workspaceId, email: s.user.email ?? "" };
}

/** For route handlers: returns the context or a 401 response. */
export async function apiCtx(): Promise<{ ok: true; ctx: Ctx } | { ok: false; response: ReturnType<typeof apiError> }> {
  const s = await auth();
  if (!s?.user?.id || !s.workspaceId) return { ok: false, response: apiError(401, "unauthenticated", "Please sign in to continue.") };
  return { ok: true, ctx: { userId: s.user.id, workspaceId: s.workspaceId, email: s.user.email ?? "" } };
}
