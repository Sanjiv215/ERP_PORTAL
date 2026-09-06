import Redis from 'ioredis';
import { env } from '../config/env.js';

let redis;

export function getRedis() {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      enableOfflineQueue: false,
      retryStrategy: () => null
    });

    redis.on('error', (error) => {
      if (env.NODE_ENV !== 'test') {
        console.warn(`Redis notice: ${error.message}`);
      }
    });
  }

  return redis;
}

export async function setRefreshTokenSession(tokenId, userId, expiresInSeconds) {
  try {
    const client = getRedis();
    if (client.status === 'end' || client.status === 'close' || client.status === 'wait') {
      await client.connect();
    }

    await client.set(`refresh:${tokenId}`, userId, 'EX', expiresInSeconds);
  } catch (error) {
    // Redis is an optional speed layer; persistent refresh tokens live in PostgreSQL
    if (env.NODE_ENV !== 'test') {
      console.warn(`Redis session cache skipped: ${error.message}`);
    }
  }
}

export async function revokeRefreshTokenSession(tokenId) {
  try {
    const client = getRedis();
    if (client.status === 'end' || client.status === 'close' || client.status === 'wait') {
      await client.connect();
    }

    await client.del(`refresh:${tokenId}`);
  } catch (error) {
    if (env.NODE_ENV !== 'test') {
      console.warn(`Redis session revocation skipped: ${error.message}`);
    }
  }
}
