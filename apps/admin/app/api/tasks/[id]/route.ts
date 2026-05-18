import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { Task } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const { response, json } = await backendFetch<Task>(`/api/tasks/${params.id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  return NextResponse.json(json, { status: response.status });
}
