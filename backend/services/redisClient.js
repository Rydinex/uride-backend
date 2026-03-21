const Redis = require('ioredis');

let redisClient = null;
let listenersRegistered = false;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
  }

  if (!listenersRegistered) {
    redisClient.on('connect', () => console.log('Redis connected'));
    redisClient.on('error', err => console.error('Redis connection error:', err));
    listenersRegistered = true;
  }

  return redisClient;
}

module.exports = {
  getRedisClient,
};
