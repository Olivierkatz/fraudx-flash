import { config as loadDotenv } from "dotenv";
import { z } from "zod";

function loadLocalDotenv(source: NodeJS.ProcessEnv): void {
  if (source !== process.env || source.NODE_ENV === "test") return;
  loadDotenv({ path: ".env", quiet: true });
  loadDotenv({ path: ".env.local", override: true, quiet: true });
}

function parseBoolean(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return value;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  PORT: z.coerce.number().int().positive().default(3001),
  ALLOWED_ORIGIN: z.string().optional(),
  MOCK_MODE: z.preprocess(parseBoolean, z.boolean()).default(false),
  APP_REPOSITORY_MODE: z.enum(["auto", "memory", "mysql"]).default("auto"),
  MYSQL_HOST: z.string().optional(),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_DATABASE: z.string().optional(),
  MYSQL_USER: z.string().optional(),
  MYSQL_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters").default("dev-session-secret-change-before-production"),
  GROUNDX_BASE_URL: z.string().url().default("https://api.groundx.ai/api/v1"),
  GROUNDX_PARTNER_API_KEY: z.string().optional(),
  GROUNDX_ANON_API_KEY: z.string().optional(),
  LLM_SERVICE: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_AUTH_HEADER_NAME: z.string().default("Authorization"),
  LLM_AUTH_SCHEME: z.string().default("Bearer"),
  LLM_MODEL_ID: z.string().optional(),
}).superRefine((env, ctx) => {
  const requiresMysql = env.NODE_ENV === "production" || env.APP_REPOSITORY_MODE === "mysql";
  for (const key of ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"] as const) {
    if (requiresMysql && !env[key]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required when using MySQL` });
    }
  }
  if (env.NODE_ENV === "production" && env.MOCK_MODE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["MOCK_MODE"],
      message: "MOCK_MODE cannot be enabled in production",
    });
  }
  if (env.NODE_ENV === "production" && !env.GROUNDX_PARTNER_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["GROUNDX_PARTNER_API_KEY"],
      message: "GROUNDX_PARTNER_API_KEY is required in production",
    });
  }
  if (env.NODE_ENV === "production" && !env.LLM_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["LLM_API_KEY"],
      message: "LLM_API_KEY is required in production",
    });
  }
  if (env.NODE_ENV === "production" && !env.LLM_SERVICE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["LLM_SERVICE"],
      message: "LLM_SERVICE is required in production",
    });
  }
  if (env.NODE_ENV === "production" && !env.LLM_MODEL_ID) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["LLM_MODEL_ID"],
      message: "LLM_MODEL_ID is required in production",
    });
  }
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  loadLocalDotenv(source);
  return envSchema.parse(source);
}
