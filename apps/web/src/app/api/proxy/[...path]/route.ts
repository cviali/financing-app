import { type NextRequest, NextResponse } from "next/server";

// Server-side proxy target — never exposed to the client
const API_BASE = "https://financing-app-api.christianviali0.workers.dev";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = path.join("/");
  const search = req.nextUrl.search;
  const url = `${API_BASE}/${apiPath}${search}`;

  // Forward request headers (cookies, CSRF token, Content-Type, etc.)
  const forwardHeaders = new Headers();
  for (const [key, value] of req.headers.entries()) {
    // Skip host — let fetch set the correct one
    if (key.toLowerCase() === "host") continue;
    forwardHeaders.set(key, value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const apiRes = await fetch(url, {
    method: req.method,
    headers: forwardHeaders,
    ...(hasBody && body !== undefined ? { body } : {}),
  });

  // Build response — forward all headers but strip Domain from Set-Cookie
  // so cookies are set on the web domain (financing-app-web.*) not the api domain
  const isHttps = req.nextUrl.protocol === "https:";
  const resHeaders = new Headers();
  for (const [key, value] of apiRes.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      // Strip Domain= attribute so cookie defaults to the proxy's host. Also strip
      // Secure when the browser is talking to us over plain HTTP (e.g. `next dev` on
      // localhost) — browsers silently drop Secure cookies on an insecure connection.
      const cleaned = value
        .split(";")
        .filter((part) => {
          const trimmed = part.trim().toLowerCase();
          if (trimmed.startsWith("domain")) return false;
          if (!isHttps && trimmed === "secure") return false;
          return true;
        })
        .join("; ");
      resHeaders.append("set-cookie", cleaned);
    } else {
      resHeaders.set(key, value);
    }
  }

  return new NextResponse(apiRes.body, {
    status: apiRes.status,
    headers: resHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
