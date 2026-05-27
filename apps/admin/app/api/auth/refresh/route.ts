import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE } from "@/lib/constants";
import { backendFetch } from "@/lib/server-api";
import type { ApiResponse } from "@/lib/types";

interface RefreshResponse {
  accessToken: string;
}

export async function POST() {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  const userCookie = cookieStore.get(USER_COOKIE)?.value;

  if (!refreshToken) {
    const response = NextResponse.json(
      { success: false, message: "Refresh token is missing" } satisfies ApiResponse<RefreshResponse>,
      { status: 401 }
    );
    response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  const { response: backendResponse, json } = await backendFetch<RefreshResponse>("/api/auth/refresh", {
    method: "POST",
    accessToken: null,
    refreshToken,
    body: JSON.stringify({ refreshToken })
  });

  const response = NextResponse.json(json, { status: backendResponse.status });

  if (!backendResponse.ok || !json.data?.accessToken) {
    response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  response.cookies.set(ACCESS_COOKIE, json.data.accessToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  });

  if (userCookie) {
    response.cookies.set(USER_COOKIE, userCookie, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60
    });
  }

  return response;
}
