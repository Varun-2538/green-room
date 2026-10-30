import { createHash } from "node:crypto";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  createLoginState,
  createPkce,
  exchangeCode,
  readLoginState,
  verifyIdToken,
} from "@/lib/auth/telegram-oidc";

const CLIENT_ID = "9290244481";
const REDIRECT = "https://green-room.test/api/auth/telegram/callback";
const NOW = new Date("2026-10-30T09:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

describe("createPkce", () => {
  it("makes an S256 challenge from a 43+ character verifier", () => {
    const { verifier, challenge } = createPkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("makes a different verifier each time", () => {
    expect(createPkce().verifier).not.toBe(createPkce().verifier);
  });
});

describe("buildAuthorizeUrl", () => {
  it("asks Telegram for an authorization code with PKCE", () => {
    const url = new URL(buildAuthorizeUrl({ clientId: CLIENT_ID, redirectUri: REDIRECT, state: "st", challenge: "ch" }));
    expect(url.origin + url.pathname).toBe("https://oauth.telegram.org/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: "openid profile",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
  });
});

describe("exchangeCode", () => {
  it("posts the code with Basic auth and the PKCE verifier, and returns the id_token", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id_token: "jwt.here", access_token: "a" }), { status: 200 }));
    const idToken = await exchangeCode({ code: "c1", verifier: "v1", clientId: CLIENT_ID, clientSecret: "s3cret", redirectUri: REDIRECT, fetch });
    expect(idToken).toBe("jwt.here");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth.telegram.org/token");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(`Basic ${Buffer.from(`${CLIENT_ID}:s3cret`).toString("base64")}`);
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      grant_type: "authorization_code",
      code: "c1",
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      code_verifier: "v1",
    });
  });

  it("throws when Telegram refuses the code", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    await expect(
      exchangeCode({ code: "c", verifier: "v", clientId: CLIENT_ID, clientSecret: "s", redirectUri: REDIRECT, fetch }),
    ).rejects.toThrow(/400/);
  });
});

describe("verifyIdToken", () => {
  async function signer() {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
    const jwks = createLocalJWKSet({ keys: [jwk] });
    const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: number } = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setIssuer(opts.iss ?? "https://oauth.telegram.org")
        .setAudience(opts.aud ?? CLIENT_ID)
        .setIssuedAt(NOW_SEC - 10)
        .setExpirationTime(opts.exp ?? NOW_SEC + 3600)
        .sign(privateKey);
    return { jwks, sign };
  }

  const claims = { sub: "s-1", id: 42, name: "Varun K", given_name: "Varun", family_name: "K", preferred_username: "varun", picture: "https://cdn.example/p.jpg" };

  it("returns the Telegram user from a valid token", async () => {
    const { jwks, sign } = await signer();
    expect(await verifyIdToken(await sign(claims), { clientId: CLIENT_ID, jwks, now: NOW })).toEqual({
      id: 42,
      first_name: "Varun",
      last_name: "K",
      username: "varun",
      photo_url: "https://cdn.example/p.jpg",
      auth_date: NOW_SEC - 10,
    });
  });

  it("falls back to the full name when there is no given name", async () => {
    const { jwks, sign } = await signer();
    const user = await verifyIdToken(await sign({ sub: "s", id: 7, name: "Arun" }), { clientId: CLIENT_ID, jwks, now: NOW });
    expect(user).toMatchObject({ id: 7, first_name: "Arun" });
  });

  it("rejects a token issued for another bot", async () => {
    const { jwks, sign } = await signer();
    await expect(verifyIdToken(await sign(claims, { aud: "111" }), { clientId: CLIENT_ID, jwks, now: NOW })).rejects.toThrow();
  });

  it("rejects a token from another issuer", async () => {
    const { jwks, sign } = await signer();
    await expect(verifyIdToken(await sign(claims, { iss: "https://evil.example" }), { clientId: CLIENT_ID, jwks, now: NOW })).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const { jwks, sign } = await signer();
    await expect(verifyIdToken(await sign(claims, { exp: NOW_SEC - 1 }), { clientId: CLIENT_ID, jwks, now: NOW })).rejects.toThrow();
  });

  it("rejects a token without a Telegram user id", async () => {
    const { jwks, sign } = await signer();
    await expect(verifyIdToken(await sign({ sub: "s", name: "No Id" }), { clientId: CLIENT_ID, jwks, now: NOW })).rejects.toThrow(/user id/i);
  });
});

describe("login state cookie", () => {
  it("round-trips state, verifier and next", async () => {
    const cookie = await createLoginState({ state: "st", verifier: "v", next: "/add?n=Arun" });
    expect(await readLoginState(cookie)).toEqual({ state: "st", verifier: "v", next: "/add?n=Arun" });
  });

  it("returns null for a tampered or missing cookie", async () => {
    const cookie = await createLoginState({ state: "st", verifier: "v", next: "/desk" });
    expect(await readLoginState(cookie.slice(0, -3) + "xyz")).toBeNull();
    expect(await readLoginState(undefined)).toBeNull();
  });
});
