import pkg from 'pg';
const { Pool } = pkg;
import { env } from '../config/env.js';

// Convert SQL ? placeholders to $1, $2, $3...
function convertPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

function normalizeResult(result) {
  if (result && result.rows) {
    result.rows.affectedRows = result.rowCount;
    result.rows.rowCount = result.rowCount;
    return [result.rows, result.fields];
  }
  return [result || [], []];
}

function wrapClient(client) {
  return {
    rawClient: client,
    async execute(sql, params = []) {
      const pgSql = convertPlaceholders(sql);
      const res = await client.query(pgSql, params);
      return normalizeResult(res);
    },
    async query(sql, params = []) {
      const pgSql = convertPlaceholders(sql);
      const res = await client.query(pgSql, params);
      return normalizeResult(res);
    },
    async beginTransaction() {
      await client.query('BEGIN');
    },
    async commit() {
      await client.query('COMMIT');
    },
    async rollback() {
      await client.query('ROLLBACK');
    },
    release() {
      client.release();
    }
  };
}

const isSslRequired = env.PG_SSL ?? (
  env.DATABASE_URL?.includes('render.com') ||
  (env.NODE_ENV === 'production' && !env.DATABASE_URL?.includes('127.0.0.1') && !env.DATABASE_URL?.includes('localhost'))
);

const poolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000
    }
  : {
      host: env.PG_HOST || '127.0.0.1',
      port: Number(env.PG_PORT) || 5433,
      user: env.PG_USER || 'sanjiv',
      password: env.PG_PASSWORD || '',
      database: env.PG_DATABASE || 'contractoros',
      ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000
    };

const pgPool = new Pool(poolConfig);

export const pool = {
  rawPool: pgPool,
  async execute(sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    const res = await pgPool.query(pgSql, params);
    return normalizeResult(res);
  },
  async query(sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    const res = await pgPool.query(pgSql, params);
    return normalizeResult(res);
  },
  async getConnection() {
    const client = await pgPool.connect();
    return wrapClient(client);
  },
  async end() {
    await pgPool.end();
  }
};

export async function withTransaction(callback) {
  const client = await pgPool.connect();
  const connection = wrapClient(client);

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
