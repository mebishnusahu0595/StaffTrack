import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromToken, parseUserCookie } from "@/lib/auth";
import { ACCESS_COOKIE, USER_COOKIE } from "@/lib/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const isSuperAdminPort = host.includes(":3002");

  // Separate Admin and Super Admin dashboards by port to prevent cookie/session overlap
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  if (isSuperAdminPort) {
    if (
      !pathname.startsWith("/superadmin") &&
      !pathname.startsWith("/super-dashboard") &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/api") &&
      pathname !== "/favicon.ico"
    ) {
      return NextResponse.redirect(new URL("/superadmin", request.url));
    }
  } else {
    if (isLocalhost && (pathname.startsWith("/superadmin") || pathname.startsWith("/super-dashboard"))) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Fallback redirects from old paths to new paths
  if (pathname === "/superadmin-login") {
    return NextResponse.redirect(new URL("/superadmin", request.url));
  }
  if (pathname === "/super-dashboard") {
    return NextResponse.redirect(new URL("/superadmin/dashboard", request.url));
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const user =
    parseUserCookie(request.cookies.get(USER_COOKIE)?.value) ??
    getSessionUserFromToken(accessToken);
  const isAuthPage = pathname === "/login" || pathname === "/superadmin";
  const isPublicForm = pathname.startsWith("/forms/fill/");
  const hasAccessToken = Boolean(accessToken);
  const canAccess = hasAccessToken && (user?.role === "SUPERADMIN" || user?.role === "ADMIN");

  if (!canAccess && !isAuthPage && !isPublicForm) {
    const redirectPath = pathname.includes("superadmin") ? "/superadmin" : "/login";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  if (canAccess && pathname === "/login") {
    const dest = user?.role === "SUPERADMIN" ? "/superadmin/dashboard" : "/";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
