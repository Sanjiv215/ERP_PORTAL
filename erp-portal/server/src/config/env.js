import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

function cleanStr(val) {
  if (typeof val !== 'string') return val;
  return val.trim().replace(/^["']|["']$/g, '').replace(/\\r/g, '').replace(/\\n/g, '').replace(/[\r\n]+/g, '').trim();
}

const envSchema = z.object({
  NODE_ENV: z
    .preprocess((val) => {
      const s = cleanStr(val)?.toLowerCase();
      if (!s) return 'development';
      if (s === 'prod') return 'production';
      if (s === 'dev') return 'development';
      return s;
    }, z.enum(['development', 'test', 'production']).default('development')),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    const cleaned = val
      .split(/[\r\n,]+/)
      .map((o) => cleanStr(o)?.replace(/\/+$/, ''))
      .filter(Boolean)
      .join(',');
    return cleaned || 'http://localhost:5173';
  }, z.string().default('http://localhost:5173')),
  DATABASE_URL: z.preprocess((val) => cleanStr(val), z.string().optional()),
  PG_HOST: z.string().default('127.0.0.1'),
  PG_PORT: z.coerce.number().default(5432),
  PG_USER: z.string().default('postgres'),
  PG_PASSWORD: z.string().default(''),
  PG_DATABASE: z.string().default('lms_business'),
  PG_SSL: z
    .preprocess((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const s = cleanStr(val).toLowerCase();
        return s === 'true' || s === '1' || s === 'yes' || s === 'require';
      }
      return false;
    }, z.boolean().default(false)),
  JWT_ACCESS_SECRET: z.preprocess((val) => cleanStr(val), z.string().min(32)),
  JWT_REFRESH_SECRET: z.preprocess((val) => cleanStr(val), z.string().min(32)),
  ACCESS_TOKEN_TTL: z.preprocess((val) => cleanStr(val), z.string().default('15m')),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  REDIS_URL: z.preprocess((val) => cleanStr(val), z.string().default('redis://127.0.0.1:6379')),
  COOKIE_SECURE: z
    .preprocess((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const s = cleanStr(val).toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
      }
      return false;
    }, z.boolean().default(false)),
  COOKIE_SAMESITE: z
    .preprocess((val) => {
      const s = cleanStr(val)?.toLowerCase();
      if (s === 'lax' || s === 'strict' || s === 'none') return s;
      return undefined;
    }, z.enum(['lax', 'strict', 'none']).optional()),
  EMPLOYEE_FIELD_ENCRYPTION_KEY_BASE64: z.preprocess((val) => cleanStr(val), z.string().min(1))
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

// Parse DATABASE_URL if provided (e.g. postgres://user:password@host:port/database)
const data = parsed.data;
if (data.DATABASE_URL) {
  try {
    const parsedUrl = new URL(data.DATABASE_URL);
    data.PG_HOST = parsedUrl.hostname || data.PG_HOST;
    data.PG_PORT = parsedUrl.port ? Number(parsedUrl.port) : data.PG_PORT;
    data.PG_USER = decodeURIComponent(parsedUrl.username || data.PG_USER);
    data.PG_PASSWORD = decodeURIComponent(parsedUrl.password || data.PG_PASSWORD);
    data.PG_DATABASE = parsedUrl.pathname.replace(/^\//, '') || data.PG_DATABASE;
    if (parsedUrl.searchParams.get('ssl') === 'true' || parsedUrl.searchParams.get('sslmode') === 'require') {
      data.PG_SSL = true;
    }
  } catch (err) {
    console.warn(`Failed to parse DATABASE_URL: ${err.message}`);
  }
}

if (data.NODE_ENV !== 'test') {
  console.log(`[Config] CLIENT_ORIGIN loaded (sanitized length: ${data.CLIENT_ORIGIN.length} chars)`);
}

export const env = data;

