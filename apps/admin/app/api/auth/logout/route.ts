import { NextResponse } from "next/server";
import { backendFetch, clearSessionCookies } from "@/lib/server-api";

export async function POST() {
  const { json } = await backendFetch("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken: "" })
  });

  const response = NextResponse.json(json);
  clearSessionCookies(response);
  return response;
}
