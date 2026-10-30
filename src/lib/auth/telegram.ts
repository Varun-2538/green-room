/** A Telegram user, as Telegram Login's id_token describes them (see telegram-oidc.ts). */
export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
};
