import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { User, UserListResponse } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = `/api/users?${searchParams.toString()}`;
  const { response, json } = await backendFetch<UserListResponse>(path);
  return NextResponse.json(json, { status: response.status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { response, json } = await backendFetch<User>("/api/users", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return NextResponse.json(json, { status: response.status });
}
