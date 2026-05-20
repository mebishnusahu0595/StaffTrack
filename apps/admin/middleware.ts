import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUserFromToken, parseUserCookie } from "@/lib/auth";
import { ACCESS_COOKIE, USER_COOKIE } from "@/lib/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  const canAccess = hasAccessToken && (user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "EMPLOYEE");

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
