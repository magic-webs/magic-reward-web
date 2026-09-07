import { NextResponse, type NextRequest } from "next/server";

// Every /api/** route already gates access with its own auth check
// (cookie or Authorization: Bearer — see lib/authToken.ts), so permissive
// CORS here doesn't expose anything extra; it just lets non-cookie
// clients from another origin — e.g. the magic-reward-app Expo web build —
// call the API at all, since browsers block cross-origin fetches (and
// their preflight OPTIONS request) without these headers regardless of
// the auth outcome.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }

  const res = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders())) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
