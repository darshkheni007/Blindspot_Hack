import { z } from "zod";
import { apiError, apiOk, clientIp, limit, parseBody } from "@/lib/http";
import { hashPassword, passwordProblem } from "@/lib/password";
import { createUserWithWorkspace, emailExists } from "@/lib/data/users";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().max(200),
});

export async function POST(req: Request) {
  const limited = limit(`signup:${clientIp(req.headers)}`, 10, 60 * 60_000);
  if (limited) return limited;
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;
  const { name, email, password } = body.data;

  const problem = passwordProblem(password);
  if (problem) return apiError(422, "validation_error", "Please check the highlighted fields.", { fieldErrors: { password: [problem] } });
  if (await emailExists(email)) {
    return apiError(409, "email_taken", "An account with this email already exists.", { fieldErrors: { email: ["An account with this email already exists."] } });
  }
  await createUserWithWorkspace({ email, name, passwordHash: await hashPassword(password) });
  return apiOk({ ok: true }, 201);
}
