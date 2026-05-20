import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, BACKEND_URL } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const cookieStore = cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

    const headers = new Headers();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(`${BACKEND_URL}/api/upload`, {
      method: "POST",
      body: formData,
      headers,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Upload Proxy] Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error during upload proxy" },
      { status: 500 }
    );
  }
}
