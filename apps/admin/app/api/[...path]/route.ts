import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/server-api";

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

async function proxyRequest(request: Request, { params }: RouteContext) {
  const url = new URL(request.url);
  const backendPath = `/api/${params.path.join("/")}${url.search}`;
  const method = request.method.toUpperCase();
  const contentType = request.headers.get("content-type") ?? "";
  const init: RequestInit = { method };

  if (method !== "GET" && method !== "HEAD") {
    if (contentType.includes("application/json")) {
      init.body = JSON.stringify(await request.json().catch(() => ({})));
    } else {
      init.body = await request.text();
    }
  }

  const { response, json } = await backendFetch(backendPath, init);
  return NextResponse.json(json, { status: response.status });
}
