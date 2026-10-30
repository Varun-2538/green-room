// Known values for every test; real keys live only in .env.local / Vercel.
Object.assign(process.env, {
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  TELEGRAM_CLIENT_ID: "9290244481",
  TELEGRAM_CLIENT_SECRET: "tg-test-secret",
  NEXT_PUBLIC_WORLD_APP_ID: "app_test",
  NEXT_PUBLIC_WORLD_RP_ID: "rp_test",
  RP_SIGNING_KEY: "0".repeat(64),
  TINYFISH_API_KEY: "tf_test",
  GROQ_API_KEY: "gsk_test",
  NEXT_PUBLIC_APP_URL: "https://green-room.test",
});
