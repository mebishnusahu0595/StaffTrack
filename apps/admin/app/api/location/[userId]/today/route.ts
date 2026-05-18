import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { LocationLog } from "@/lib/types";

export async function GET(_: Request, { params }: { params: { userId: string } }) {
  const { response, json } = await backendFetch<LocationLog[]>(`/api/location/${params.userId}/today`);
  return NextResponse.json(json, { status: response.status });
}
