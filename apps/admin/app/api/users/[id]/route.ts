import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";
import type { User } from "@/lib/types";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { response, json } = await backendFetch<User>(`/api/users/${params.id}`);
  return NextResponse.json(json, { status: response.status });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const { response, json } = await backendFetch<User>(`/api/users/${params.id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  return NextResponse.json(json, { status: response.status });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { response, json } = await backendFetch<{ deleted: boolean }>(`/api/users/${params.id}`, {
    method: "DELETE"
  });
  return NextResponse.json(json, { status: response.status });
}
