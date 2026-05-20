import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { DayEndReport } from "@/lib/types";

export async function GET(_: Request, { params }: { params: { userId: string } }) {
  const { response, json } = await backendFetch<DayEndReport[]>(`/api/reports/der/${params.userId}`);
  return NextResponse.json(json, { status: response.status });
}
