import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { DayEndReport } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const path = `/api/reports/der${userId ? `?userId=${userId}` : ""}`;
  const { response, json } = await backendFetch<DayEndReport[]>(path);
  return NextResponse.json(json, { status: response.status });
}
