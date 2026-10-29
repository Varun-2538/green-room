import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
};

const MAX_AGE_SECONDS = 86_400;
const OPTIONAL_FIELDS = ["last_name", "username", "photo_url"] as const;

/**
 * Checks a Telegram Login Widget callback (https://core.telegram.org/widgets/login#checking-authorization).
 * Returns the user only when the hash matches and the login is under 24 hours old.
 */
export function verifyTelegramAuth(
  params: Record<string, string>,
  botToken: string,
  now: Date,
): TelegramUser | null {
  const { hash, ...rest } = params;
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;

  const id = Number(rest.id);
  const authDate = Number(rest.auth_date);
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(authDate) || !rest.first_name) return null;
  if (Math.floor(now.getTime() / 1000) - authDate > MAX_AGE_SECONDS) return null;

  const user: TelegramUser = { id, first_name: rest.first_name, auth_date: authDate };
  for (const field of OPTIONAL_FIELDS) {
    if (rest[field]) user[field] = rest[field];
  }
  return user;
}
