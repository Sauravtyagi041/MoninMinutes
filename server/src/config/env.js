import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: bool.default(false),
  TRUST_PROXY: bool.default(false),
  SESSION_DAYS: z.coerce.number().default(7),

  AI_PROVIDER: z.enum(['openai', 'anthropic', 'openai-compatible']).default('openai'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default(''),
  AI_BASE_URL: z.string().default(''),
  AI_TIMEOUT_MS: z.coerce.number().default(90000),
  AI_MAX_RETRIES: z.coerce.number().default(2),
  AI_CHUNK_TOKENS: z.coerce.number().default(6000),
  AI_CHUNK_OVERLAP_SEGMENTS: z.coerce.number().default(3),
  MAX_TRANSCRIPT_CHARS: z.coerce.number().default(400000),
  MAX_CHUNKS_PER_MEETING: z.coerce.number().default(20),
  MAX_ACTIVE_JOBS_PER_USER: z.coerce.number().default(3),
  MAX_JOB_ATTEMPTS: z.coerce.number().default(3),
  JOB_STALE_MS: z.coerce.number().default(120000),
  JOB_POLL_MS: z.coerce.number().default(1500),
  JOB_RETENTION_DAYS: z.coerce.number().default(30),
  WORKER_ENABLED: bool.default(true),
  RATE_LIMIT_ENABLED: bool.default(true),

  MAX_FILE_BYTES: z.coerce.number().default(5 * 1024 * 1024),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const clientOrigins = env.CLIENT_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
