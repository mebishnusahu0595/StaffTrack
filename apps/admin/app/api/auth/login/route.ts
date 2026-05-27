import { NextResponse } from "next/server";
import { clearSessionCookies, setSessionCookies, backendFetch } from "@/lib/server-api";
import type { LoginResponse } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const { response, json } = await backendFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!response.ok || !json.data) {
    const errorResponse = NextResponse.json(json, { status: response.status });
    clearSessionCookies(errorResponse);
    return errorResponse;
  }

  // Restrict access to SUPERADMIN and ADMIN only
  const role = json.data.user?.role;
  if (role !== "SUPERADMIN" && role !== "ADMIN") {
    const errorResponse = NextResponse.json({
      success: false,
      message: "Access denied",
      error: "Only administrators can access the admin panel."
    }, { status: 403 });
    clearSessionCookies(errorResponse);
    return errorResponse;
  }

  const result = NextResponse.json(json);
  setSessionCookies(result, json.data);
  return result;
}
