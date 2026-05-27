import { NextResponse, type NextRequest } from "next/server";

const BLOCKED_CLI_USER_AGENT_PREFIXES = ["curl/"];

export function proxy(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const isBlockedCliRequest = BLOCKED_CLI_USER_AGENT_PREFIXES.some((prefix) =>
    userAgent.startsWith(prefix),
  );

  if (process.env.NODE_ENV === "production" && isBlockedCliRequest) {
    return new NextResponse(null, {
      status: 403,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
