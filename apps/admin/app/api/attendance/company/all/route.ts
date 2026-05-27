import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { AttendanceRecord } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = `/api/attendance/company/all${query ? `?${query}` : ""}`;
  const { response, json } = await backendFetch<AttendanceRecord[]>(path);
  return NextResponse.json(json, { status: response.status });
}
