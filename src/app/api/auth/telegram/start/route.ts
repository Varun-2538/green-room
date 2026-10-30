import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import {
  buildAuthorizeUrl,
  createLoginState,
  createPkce,
  LOGIN_STATE_COOKIE,
  LOGIN_STATE_MAX_AGE_SECONDS,
} from "@/lib/auth/telegram-oidc";
import { env } from "@/lib/env";

const CALLBACK_PATH = "/api/auth/telegram/callback";

/** Starts Telegram Login: remembers PKCE + state in a short-lived cookie, then sends the user to Telegram. */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/desk");
  const { verifier, challenge } = createPkce();
  const state = randomBytes(16).toString("base64url");

  const response = NextResponse.redirect(
    buildAuthorizeUrl({
      clientId: env.TELEGRAM_CLIENT_ID,
      redirectUri: `${env.NEXT_PUBLIC_APP_URL}${CALLBACK_PATH}`,
      state,
      challenge,
    }),
  );
  response.cookies.set(LOGIN_STATE_COOKIE, await createLoginState({ state, verifier, next }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/telegram",
    maxAge: LOGIN_STATE_MAX_AGE_SECONDS,
  });
  return response;
}
