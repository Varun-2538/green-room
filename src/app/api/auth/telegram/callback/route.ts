import { type NextRequest, NextResponse } from "next/server";
import { postLoginDestination } from "@/lib/auth/redirect";
import { createSessionCookie, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { exchangeCode, LOGIN_STATE_COOKIE, readLoginState, verifyIdToken } from "@/lib/auth/telegram-oidc";
import { upsertCreatorFromTelegram } from "@/lib/creators";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";

const fail = () => NextResponse.redirect(new URL("/?error=login", env.NEXT_PUBLIC_APP_URL));

/** Telegram redirects here with ?code&state. Exchange the code, verify the id_token, start a session. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const saved = await readLoginState(request.cookies.get(LOGIN_STATE_COOKIE)?.value);
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) return fail();

  try {
    const idToken = await exchangeCode({
      code,
      verifier: saved.verifier,
      clientId: env.TELEGRAM_CLIENT_ID,
      clientSecret: env.TELEGRAM_CLIENT_SECRET,
      redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/auth/telegram/callback`,
    });
    const user = await verifyIdToken(idToken, { clientId: env.TELEGRAM_CLIENT_ID });
    const creator = await upsertCreatorFromTelegram(getDb(), user);
    const destination = postLoginDestination(saved.next, Boolean(creator.verifiedAt));

    const response = NextResponse.redirect(new URL(destination, env.NEXT_PUBLIC_APP_URL));
    response.cookies.set(SESSION_COOKIE, await createSessionCookie(creator.id), sessionCookieOptions);
    response.cookies.delete({ name: LOGIN_STATE_COOKIE, path: "/api/auth/telegram" });
    return response;
  } catch (error) {
    console.error("telegram login failed", error);
    return fail();
  }
}
