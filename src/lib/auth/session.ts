import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCreator } from "@/lib/creators";
import type { Db } from "@/lib/db/client";
import type { Creator } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "gr_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const secretKey = () => new TextEncoder().encode(env.SESSION_SECRET);

export async function createSessionCookie(creatorId: string): Promise<string> {
  return new SignJWT({ creatorId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function readSession(cookieValue?: string): Promise<{ creatorId: string } | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.creatorId === "string" ? { creatorId: payload.creatorId } : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/** The signed-in creator, or null. For pages and routes that also serve visitors. */
export async function currentCreator(db: Db): Promise<Creator | null> {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? getCreator(db, session.creatorId) : null;
}

/** The signed-in creator; redirects to the landing page when there is none. */
export async function requireCreator(db: Db, next?: string): Promise<Creator> {
  const creator = await currentCreator(db);
  if (!creator) redirect(next ? `/?next=${encodeURIComponent(next)}` : "/");
  return creator;
}
