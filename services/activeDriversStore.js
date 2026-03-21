const { getRedisClient } = require('./redisClient');

const ACTIVE_DRIVERS_GEO_KEY = 'active:drivers:geo';
const ACTIVE_DRIVERS_LAST_SEEN_KEY = 'active:drivers:last_seen';
const ACTIVE_DRIVER_PREFIX = 'active:driver:';
const SOCKET_DRIVER_PREFIX = 'active:socket:driver:';

const HEARTBEAT_TTL_SECONDS = Number(process.env.DRIVER_HEARTBEAT_TTL_SECONDS || 15);
const HEARTBEAT_TTL_MS = HEARTBEAT_TTL_SECONDS * 1000;

const inMemoryDrivers = new Map();
const inMemorySockets = new Map();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureCoordinates(latitude, longitude) {
  const parsedLatitude = toNumber(latitude);
  const parsedLongitude = toNumber(longitude);

  if (parsedLatitude === null || parsedLongitude === null) {
    throw new Error('latitude and longitude must be valid numbers.');
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
}

function ensureDriverId(driverId) {
  if (!driverId || typeof driverId !== 'string') {
    throw new Error('driverId is required.');
  }
}

function setDriverHeartbeatInMemory({ driverId, latitude, longitude, socketId }) {
  const timestamp = Date.now();

  inMemoryDrivers.set(driverId, {
    driverId,
    latitude,
    longitude,
    updatedAt: timestamp,
    socketId: socketId || null,
  });

  if (socketId) {
    inMemorySockets.set(socketId, driverId);
  }

  return {
    driverId,
    latitude,
    longitude,
    updatedAt: timestamp,
  };
}

function removeDriverInMemory(driverId) {
  const existing = inMemoryDrivers.get(driverId);
  if (!existing) {
    return false;
  }

  if (existing.socketId) {
    inMemorySockets.delete(existing.socketId);
  }

  inMemoryDrivers.delete(driverId);
  return true;
}

function pruneInMemoryStaleDrivers() {
  const cutoff = Date.now() - HEARTBEAT_TTL_MS;

  inMemoryDrivers.forEach((value, key) => {
    if (value.updatedAt < cutoff) {
      if (value.socketId) {
        inMemorySockets.delete(value.socketId);
      }
      inMemoryDrivers.delete(key);
    }
  });
}

function haversineDistanceKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const earthRadiusKm = 6371;
  const deltaLatitude = (latitudeB - latitudeA) * (Math.PI / 180);
  const deltaLongitude = (longitudeB - longitudeA) * (Math.PI / 180);

  const originLatitude = latitudeA * (Math.PI / 180);
  const targetLatitude = latitudeB * (Math.PI / 180);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2) * Math.cos(originLatitude) * Math.cos(targetLatitude);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

async function pruneRedisStaleDrivers(redisClient) {
  const cutoff = Date.now() - HEARTBEAT_TTL_MS;
  const staleDriverIds = await redisClient.zrangebyscore(ACTIVE_DRIVERS_LAST_SEEN_KEY, '-inf', cutoff);

  if (!staleDriverIds.length) {
    return;
  }

  const pipeline = redisClient.pipeline();
  staleDriverIds.forEach(driverId => {
    pipeline.zrem(ACTIVE_DRIVERS_LAST_SEEN_KEY, driverId);
    pipeline.zrem(ACTIVE_DRIVERS_GEO_KEY, driverId);
    pipeline.del(`${ACTIVE_DRIVER_PREFIX}${driverId}`);
  });

  await pipeline.exec();
}

async function heartbeatDriver({ driverId, latitude, longitude, socketId }) {
  ensureDriverId(driverId);
  const normalizedCoordinates = ensureCoordinates(latitude, longitude);
  const timestamp = Date.now();

  try {
    const redisClient = getRedisClient();

    const pipeline = redisClient.pipeline();
    pipeline.call('GEOADD', ACTIVE_DRIVERS_GEO_KEY, String(normalizedCoordinates.longitude), String(normalizedCoordinates.latitude), driverId);
    pipeline.zadd(ACTIVE_DRIVERS_LAST_SEEN_KEY, String(timestamp), driverId);
    pipeline.hset(
      `${ACTIVE_DRIVER_PREFIX}${driverId}`,
      'driverId',
      driverId,
      'latitude',
      String(normalizedCoordinates.latitude),
      'longitude',
      String(normalizedCoordinates.longitude),
      'updatedAt',
      String(timestamp),
      'socketId',
      socketId || ''
    );
    pipeline.expire(`${ACTIVE_DRIVER_PREFIX}${driverId}`, HEARTBEAT_TTL_SECONDS);

    if (socketId) {
      pipeline.set(`${SOCKET_DRIVER_PREFIX}${socketId}`, driverId, 'EX', HEARTBEAT_TTL_SECONDS);
    }

    await pipeline.exec();

    return {
      driverId,
      latitude: normalizedCoordinates.latitude,
      longitude: normalizedCoordinates.longitude,
      updatedAt: timestamp,
      backend: 'redis',
    };
  } catch (error) {
    const inMemoryHeartbeat = setDriverHeartbeatInMemory({
      driverId,
      latitude: normalizedCoordinates.latitude,
      longitude: normalizedCoordinates.longitude,
      socketId,
    });

    return {
      ...inMemoryHeartbeat,
      backend: 'memory',
    };
  }
}

async function setDriverOffline(driverId) {
  ensureDriverId(driverId);

  try {
    const redisClient = getRedisClient();
    const driverHashKey = `${ACTIVE_DRIVER_PREFIX}${driverId}`;
    const socketId = await redisClient.hget(driverHashKey, 'socketId');

    const pipeline = redisClient.pipeline();
    pipeline.zrem(ACTIVE_DRIVERS_LAST_SEEN_KEY, driverId);
    pipeline.zrem(ACTIVE_DRIVERS_GEO_KEY, driverId);
    pipeline.del(driverHashKey);

    if (socketId) {
      pipeline.del(`${SOCKET_DRIVER_PREFIX}${socketId}`);
    }

    await pipeline.exec();
    return true;
  } catch (error) {
    return removeDriverInMemory(driverId);
  }
}

async function setDriverOfflineBySocketId(socketId) {
  if (!socketId) {
    return false;
  }

  try {
    const redisClient = getRedisClient();
    const socketDriverKey = `${SOCKET_DRIVER_PREFIX}${socketId}`;
    const driverId = await redisClient.get(socketDriverKey);

    if (!driverId) {
      return false;
    }

    await setDriverOffline(driverId);
    await redisClient.del(socketDriverKey);
    return true;
  } catch (error) {
    const driverId = inMemorySockets.get(socketId);
    if (!driverId) {
      return false;
    }

    inMemorySockets.delete(socketId);
    return removeDriverInMemory(driverId);
  }
}

async function queryNearbyDrivers({ latitude, longitude, radiusKm = 5, limit = 20 }) {
  const normalizedCoordinates = ensureCoordinates(latitude, longitude);
  const parsedRadiusKm = Math.max(0.1, Number(radiusKm) || 5);
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

  try {
    const redisClient = getRedisClient();
    await pruneRedisStaleDrivers(redisClient);

    const result = await redisClient.call(
      'GEOSEARCH',
      ACTIVE_DRIVERS_GEO_KEY,
      'FROMLONLAT',
      String(normalizedCoordinates.longitude),
      String(normalizedCoordinates.latitude),
      'BYRADIUS',
      String(parsedRadiusKm),
      'km',
      'WITHDIST',
      'ASC',
      'COUNT',
      String(parsedLimit)
    );

    if (!Array.isArray(result) || !result.length) {
      return [];
    }

    const driverIds = result.map(entry => (Array.isArray(entry) ? entry[0] : entry));
    const distanceLookup = new Map(
      result.map(entry => {
        if (Array.isArray(entry)) {
          return [entry[0], Number(entry[1] || 0)];
        }
        return [entry, null];
      })
    );

    const pipeline = redisClient.pipeline();
    driverIds.forEach(driverId => pipeline.hgetall(`${ACTIVE_DRIVER_PREFIX}${driverId}`));
    const metadataResults = await pipeline.exec();

    const cutoff = Date.now() - HEARTBEAT_TTL_MS;

    return metadataResults
      .map(([, metadata], index) => {
        const driverId = driverIds[index];
        const updatedAt = Number(metadata?.updatedAt || 0);

        if (!metadata || !metadata.driverId || updatedAt < cutoff) {
          return null;
        }

        return {
          driverId,
          latitude: Number(metadata.latitude),
          longitude: Number(metadata.longitude),
          distanceKm: distanceLookup.get(driverId),
          updatedAt,
        };
      })
      .filter(Boolean);
  } catch (error) {
    pruneInMemoryStaleDrivers();

    const nearbyDrivers = [];

    inMemoryDrivers.forEach(driver => {
      const distanceKm = haversineDistanceKm(
        normalizedCoordinates.latitude,
        normalizedCoordinates.longitude,
        driver.latitude,
        driver.longitude
      );

      if (distanceKm <= parsedRadiusKm) {
        nearbyDrivers.push({
          driverId: driver.driverId,
          latitude: driver.latitude,
          longitude: driver.longitude,
          distanceKm,
          updatedAt: driver.updatedAt,
        });
      }
    });

    nearbyDrivers.sort((left, right) => left.distanceKm - right.distanceKm);
    return nearbyDrivers.slice(0, parsedLimit);
  }
}

module.exports = {
  heartbeatDriver,
  setDriverOffline,
  setDriverOfflineBySocketId,
  queryNearbyDrivers,
};
