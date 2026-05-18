import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { Expense } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = `/api/expenses${query ? `?${query}` : ""}`;
  const { response, json } = await backendFetch<Expense[]>(path);
  return NextResponse.json(json, { status: response.status });
}
