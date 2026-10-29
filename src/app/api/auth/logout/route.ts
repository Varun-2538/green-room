import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { env } from "@/lib/env";

export async function POST() {
  const response = NextResponse.redirect(new URL("/", env.NEXT_PUBLIC_APP_URL), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
