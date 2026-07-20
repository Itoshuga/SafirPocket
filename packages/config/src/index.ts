import { z } from 'zod';

export const apiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  WEB_ORIGINS: z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
        : value,
    z.array(z.url()).default([]),
  ),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CARD_IMPORT_MAX_FILE_BYTES: z.coerce.number().int().min(1024).max(20_000_000).default(5_242_880),
  CARD_IMPORT_MAX_ROWS: z.coerce.number().int().min(1).max(20_000).default(5_000),
  CARD_IMPORT_PREVIEW_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  CARD_EXPORT_MAX_ROWS: z.coerce.number().int().min(1).max(100_000).default(50_000),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function validateApiEnvironment(values: Record<string, unknown>): ApiEnvironment {
  const parsed = apiEnvironmentSchema.safeParse(values);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuration API invalide. Variables à vérifier : ${fields}`);
  }
  return parsed.data;
}
