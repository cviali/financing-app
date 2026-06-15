import { type NextRequest, NextResponse } from "next/server";

// Public paths that don't need auth
const PUBLIC_PATHS = ["/login", "/change-password"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass through everything — auth is enforced client-side via AuthContext
  // and server-side via the API Worker. The session cookie is on the API domain
  // (.christianviali0.workers.dev), not the web domain, so middleware can't read it.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
