import { createClient } from 'redis';

let client;

export async function connectCache() {
  if (!process.env.REDIS_URL) return false;
  const candidate = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 3000, reconnectStrategy: () => false } });
  candidate.on('error', error => console.warn('Redis cache error:', error.message));
  try {
    await candidate.connect();
    client = candidate;
    return true;
  } catch (error) {
    console.warn('Redis unavailable; report caching is disabled:', error.message);
    candidate.destroy();
    return false;
  }
}

export async function getOrSetCache(key, load, ttlSeconds = 60) {
  if (!client?.isReady) return load();
  try {
    const value = await client.get(key);
    if (value !== null) return JSON.parse(value);
  } catch (error) {
    console.warn('Could not read report cache:', error.message);
  }

  const result = await load();
  try {
    await client.set(key, JSON.stringify(result), { EX: ttlSeconds });
  } catch (error) {
    console.warn('Could not write report cache:', error.message);
  }
  return result;
}

export async function invalidateReportCache(userId) {
  if (!client?.isReady) return;
  try {
    let cursor = '0';
    do {
      const result = await client.scan(cursor, { MATCH: `sweety:report:${userId}:*`, COUNT: 100 });
      cursor = result.cursor;
      if (result.keys.length) await client.del(result.keys);
    } while (cursor !== '0');
  } catch (error) {
    console.warn('Could not invalidate report cache:', error.message);
  }
}
