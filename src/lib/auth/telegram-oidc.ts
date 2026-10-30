import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type { TelegramUser } from "@/lib/auth/telegram";
import { env } from "@/lib/env";

// Telegram Login, OpenID Connect flow (https://core.telegram.org/bots/telegram-login).
const ISSUER = "https://oauth.telegram.org";
const AUTHORIZE_URL = `${ISSUER}/auth`;
const TOKEN_URL = `${ISSUER}/token`;
const telegramJwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export const LOGIN_STATE_COOKIE = "gr_login";
export const LOGIN_STATE_MAX_AGE_SECONDS = 600;

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function buildAuthorizeUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: "code",
    scope: "openid profile",
    state: o.state,
    code_challenge: o.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** Server-side code exchange; returns Telegram's signed id_token. */
export async function exchangeCode(o: {
  code: string;
  verifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetch?: typeof fetch;
}): Promise<string> {
  const response = await (o.fetch ?? fetch)(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${o.clientId}:${o.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: o.code,
      redirect_uri: o.redirectUri,
      client_id: o.clientId,
      code_verifier: o.verifier,
    }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Telegram token endpoint answered ${response.status}`);
  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string") throw new Error("Telegram returned no id_token");
  return body.id_token;
}

const claimsSchema = z.object({
  id: z.number().int().positive({ message: "Token has no Telegram user id" }),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  preferred_username: z.string().optional(),
  picture: z.string().optional(),
  iat: z.number(),
});

/** Checks the id_token's signature, issuer, audience (our bot) and expiry, then returns the Telegram user. */
export async function verifyIdToken(
  idToken: string,
  o: { clientId: string; jwks?: JWTVerifyGetKey; now?: Date },
): Promise<TelegramUser> {
  const { payload } = await jwtVerify(idToken, o.jwks ?? telegramJwks, {
    issuer: ISSUER,
    audience: o.clientId,
    ...(o.now ? { currentDate: o.now } : {}),
  });
  const parsed = claimsSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Token has no Telegram user id");
  const c = parsed.data;
  const firstName = c.given_name || c.name || c.preferred_username || "Telegram user";
  return {
    id: c.id,
    first_name: firstName,
    ...(c.given_name && c.family_name ? { last_name: c.family_name } : {}),
    ...(c.preferred_username ? { username: c.preferred_username } : {}),
    ...(c.picture ? { photo_url: c.picture } : {}),
    auth_date: c.iat,
  };
}

type LoginState = { state: string; verifier: string; next: string };

const stateKey = () => new TextEncoder().encode(`login-state:${env.SESSION_SECRET}`);

/** The PKCE verifier and CSRF state live in a short-lived signed cookie between /start and /callback. */
export async function createLoginState(s: LoginState): Promise<string> {
  return new SignJWT(s)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${LOGIN_STATE_MAX_AGE_SECONDS}s`)
    .sign(stateKey());
}

export async function readLoginState(cookie?: string): Promise<LoginState | null> {
  if (!cookie) return null;
  try {
    const { payload } = await jwtVerify(cookie, stateKey(), { algorithms: ["HS256"] });
    const { state, verifier, next } = payload as Partial<LoginState>;
    return typeof state === "string" && typeof verifier === "string" && typeof next === "string" ? { state, verifier, next } : null;
  } catch {
    return null;
  }
}
