import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { env } from "./env";
import { rateLimit } from "./rate-limit";

/** Consistent API error shape: { code, message, fieldErrors? } */
export function apiError(
  status: number,
  code: string,
  message: string,
  extra?: { fieldErrors?: Record<string, string[]>; headers?: Record<string, string> },
) {
  return NextResponse.json(
    { code, message, ...(extra?.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}) },
    { status, headers: { "Cache-Control": "no-store", ...extra?.headers } },
  );
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function parseBody<S extends ZodType>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: apiError(400, "invalid_json", "Request body must be valid JSON.") };
  }
  return parseValue(raw, schema);
}

export function parseValue<S extends ZodType>(
  raw: unknown,
  schema: S,
): { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(422, "validation_error", "Please check the highlighted fields.", {
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      }),
    };
  }
  return { ok: true, data: parsed.data };
}

export function clientIp(headers: Headers): string {
  if (env.trustProxy) {
    return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  }
  return "local";
}

/** Returns a 429 response when the bucket is exhausted, else null. */
export function limit(key: string, max: number, windowMs: number): NextResponse | null {
  const r = rateLimit(key, max, windowMs);
  if (r.limited) {
    return apiError(429, "rate_limited", "Too many requests. Please slow down and try again shortly.", {
      headers: { "Retry-After": String(r.retryAfterSec) },
    });
  }
  return null;
}
