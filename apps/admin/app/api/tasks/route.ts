import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { Task } from "@/lib/types";

export async function GET() {
  const { response, json } = await backendFetch<Task[]>("/api/tasks");
  return NextResponse.json(json, { status: response.status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { response, json } = await backendFetch<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return NextResponse.json(json, { status: response.status });
}
