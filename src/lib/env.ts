import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  TELEGRAM_CLIENT_ID: z.string().regex(/^[0-9]+$/, "TELEGRAM_CLIENT_ID is the numeric Client ID from @BotFather"),
  TELEGRAM_CLIENT_SECRET: z.string().min(1),
  NEXT_PUBLIC_WORLD_APP_ID: z.string().min(1),
  NEXT_PUBLIC_WORLD_RP_ID: z.string().min(1),
  RP_SIGNING_KEY: z.string().min(1),
  TINYFISH_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-120b"),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return parsed.data;
}

let cached: Env | undefined;

/** Server-side env, parsed on first access so importing this module never throws. */
export const env: Env = new Proxy({} as Env, {
  get(_target, key: string) {
    cached ??= loadEnv(process.env);
    return cached[key as keyof Env];
  },
});
