import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redis) {
        const redisUrl = process.env.REDIS_URL;

        if (!redisUrl) {
            throw new Error('REDIS_URL environment variable is not set');
        }

        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        redis.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        redis.on('connect', () => {
            console.log('Redis Client Connected');
        });
    }

    return redis;
}

export const kv = getRedisClient();
