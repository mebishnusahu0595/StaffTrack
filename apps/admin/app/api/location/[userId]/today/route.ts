import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { LocationLog } from "@/lib/types";

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const path = `/api/location/${params.userId}/today${query ? `?${query}` : ""}`;
  const { response, json } = await backendFetch<LocationLog[]>(path);
  return NextResponse.json(json, { status: response.status });
}
