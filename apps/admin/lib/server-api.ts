import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, BACKEND_URL, REFRESH_COOKIE, USER_COOKIE } from "@/lib/constants";
import type { ApiResponse, User } from "@/lib/types";

const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export async function backendFetch<T>(
  path: string,
  init: RequestInit & {
    accessToken?: string | null;
    refreshToken?: string | null;
  } = {}
) {
  const cookieStore = cookies();
  const accessToken = init.accessToken ?? cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = init.refreshToken ?? cookieStore.get(REFRESH_COOKIE)?.value;
  const headers = new Headers(init.headers);

  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (refreshToken) {
    headers.set("x-refresh-token", refreshToken);
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const json = (await response.json().catch(() => ({
    success: false,
    message: "Unexpected backend response",
    error: "Invalid JSON"
  }))) as ApiResponse<T>;

  return { response, json };
}

export function setSessionCookies(
  response: NextResponse,
  session: { accessToken: string; refreshToken: string; user: User }
) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE
  });
  response.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(session.user)), {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
}
