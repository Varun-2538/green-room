// Known values for every test; real keys live only in .env.local / Vercel.
Object.assign(process.env, {
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  TELEGRAM_LOGIN_BOT_TOKEN: "123456:TEST_BOT_TOKEN",
  NEXT_PUBLIC_TELEGRAM_LOGIN_BOT: "green_room_login_bot",
  NEXT_PUBLIC_WORLD_APP_ID: "app_test",
  NEXT_PUBLIC_WORLD_RP_ID: "rp_test",
  RP_SIGNING_KEY: "0".repeat(64),
  TINYFISH_API_KEY: "tf_test",
  GROQ_API_KEY: "gsk_test",
  NEXT_PUBLIC_APP_URL: "https://green-room.test",
});
