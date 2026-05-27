import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { AttendanceRecord } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = `/api/attendance${query ? `?${query}` : ""}`;
  const { response, json } = await backendFetch<AttendanceRecord[]>(path);
  return NextResponse.json(json, { status: response.status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { response, json } = await backendFetch<AttendanceRecord>("/api/attendance/mark", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return NextResponse.json(json, { status: response.status });
}
