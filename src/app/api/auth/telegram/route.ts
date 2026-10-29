import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSessionCookie, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { verifyTelegramAuth } from "@/lib/auth/telegram";
import { upsertCreatorFromTelegram } from "@/lib/creators";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";

// Only the widget's own fields are signed; `next` is ours and must stay out of the hash check.
const TELEGRAM_FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"];

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  for (const field of TELEGRAM_FIELDS) {
    const value = search.get(field);
    if (value !== null) params[field] = value;
  }

  const user = verifyTelegramAuth(params, env.TELEGRAM_LOGIN_BOT_TOKEN, new Date());
  if (!user) return NextResponse.redirect(new URL("/?error=login", env.NEXT_PUBLIC_APP_URL));

  const creator = await upsertCreatorFromTelegram(getDb(), user);
  const destination = creator.verifiedAt
    ? safeNextPath(search.get("next"), "/desk")
    : `/verify?next=${encodeURIComponent(safeNextPath(search.get("next"), "/desk"))}`;

  const response = NextResponse.redirect(new URL(destination, env.NEXT_PUBLIC_APP_URL));
  response.cookies.set(SESSION_COOKIE, await createSessionCookie(creator.id), sessionCookieOptions);
  return response;
}
