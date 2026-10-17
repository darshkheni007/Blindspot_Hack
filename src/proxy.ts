import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: send visitors without a session cookie to sign-in.
 * This is only a redirect convenience. Every page and route re-checks the session itself.
 */
export function proxy(req: NextRequest) {
  const has = req.cookies.has("authjs.session-token") || req.cookies.has("__Secure-authjs.session-token");
  if (!has) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/projects/:path*", "/settings/:path*"] };
