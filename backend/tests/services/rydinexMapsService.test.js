/**
 * RydinexMapsService Tests
 * Tests for trip location recording, polyline management, and real-time tracking.
 * RydinexMaps is a standalone public platform — rider app, driver app, and admin
 * all connect to these same backend services.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ─── Mocks ───────────────────────────────────────────────────────────────────

let savedLocations = [];
let redisStore = {};

const mockLocationHistory = {
  create: async (data) => {
    const record = { _id: `loc_${Date.now()}`, ...data };
    savedLocations.push(record);
    return record;
  },
  find: ({ tripId }) => ({
    select: () => ({
      sort: () => ({
        lean: async () =>
          savedLocations
            .filter(l => l.tripId === tripId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      }),
    }),
  }),
  findOne: ({ driverId } = {}) => ({
    sort: () => ({
      select: () => ({
        lean: async () =>
          savedLocations
            .filter(l => l.driverId === driverId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null,
      }),
    }),
  }),
};

const mockRedisClient = {
  setex: async (key, ttl, value) => { redisStore[key] = value; },
  get: async (key) => redisStore[key] || null,
  geoadd: async () => 1,
  expire: async () => 1,
};

// Inject mocks into require cache before loading service
require.cache[require.resolve('../../models/LocationHistory')] = { id: 'loc', filename: 'loc', loaded: true, exports: mockLocationHistory };
require.cache[require.resolve('../../services/redisClient')] = {
  id: 'redis', filename: 'redis', loaded: true,
  exports: { getRedisClient: () => mockRedisClient },
};

const rydinexMapsService = require('../../services/rydinexMapsService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetState() {
  savedLocations = [];
  redisStore = {};
}

const TRIP_ID = 'trip_abc123';
const DRIVER_ID = 'driver_xyz789';

const validLocation = {
  latitude: 41.8781,
  longitude: -87.6298,
  accuracy: 10,
  speed: 30,
  heading: 90,
  altitude: 180,
};

// ─── recordLocation ───────────────────────────────────────────────────────────

test('recordLocation saves to MongoDB and caches in Redis', async () => {
  resetState();
  const result = await rydinexMapsService.recordLocation(TRIP_ID, DRIVER_ID, validLocation);

  assert.ok(result._id, 'Should return a record with an _id');
  assert.equal(result.tripId, TRIP_ID);
  assert.equal(result.driverId, DRIVER_ID);
  assert.equal(result.latitude, 41.8781);
  assert.equal(result.longitude, -87.6298);

  // Redis cache should be set
  const cacheKey = `rydinex:trip:locations:${TRIP_ID}`;
  assert.ok(redisStore[cacheKey], 'Location should be cached in Redis');
  const cached = JSON.parse(redisStore[cacheKey]);
  assert.equal(cached.latitude, 41.8781);
  assert.equal(cached.driverId, DRIVER_ID);
});

test('recordLocation throws if tripId is missing', async () => {
  resetState();
  await assert.rejects(
    () => rydinexMapsService.recordLocation(null, DRIVER_ID, validLocation),
    /Missing required location fields/
  );
});

test('recordLocation throws if driverId is missing', async () => {
  resetState();
  await assert.rejects(
    () => rydinexMapsService.recordLocation(TRIP_ID, null, validLocation),
    /Missing required location fields/
  );
});

test('recordLocation throws if latitude is missing', async () => {
  resetState();
  await assert.rejects(
    () => rydinexMapsService.recordLocation(TRIP_ID, DRIVER_ID, { longitude: -87.6298 }),
    /Missing required location fields/
  );
});

test('recordLocation throws if longitude is missing', async () => {
  resetState();
  await assert.rejects(
    () => rydinexMapsService.recordLocation(TRIP_ID, DRIVER_ID, { latitude: 41.8781 }),
    /Missing required location fields/
  );
});

// ─── getTripPolyline ─────────────────────────────────────────────────────────

test('getTripPolyline returns ordered points for a trip', async () => {
  resetState();
  // Pre-populate locations
  savedLocations = [
    { tripId: TRIP_ID, driverId: DRIVER_ID, latitude: 41.878, longitude: -87.629, timestamp: new Date('2026-01-01T10:00:00Z'), speed: 20 },
    { tripId: TRIP_ID, driverId: DRIVER_ID, latitude: 41.879, longitude: -87.630, timestamp: new Date('2026-01-01T10:01:00Z'), speed: 25 },
    { tripId: TRIP_ID, driverId: DRIVER_ID, latitude: 41.880, longitude: -87.631, timestamp: new Date('2026-01-01T10:02:00Z'), speed: 30 },
  ];

  const polyline = await rydinexMapsService.getTripPolyline(TRIP_ID);

  assert.equal(polyline.length, 3);
  assert.ok('lat' in polyline[0]);
  assert.ok('lng' in polyline[0]);
  assert.equal(polyline[0].lat, 41.878);
  assert.equal(polyline[2].lat, 41.880);
});

test('getTripPolyline returns empty array when no locations exist', async () => {
  resetState();
  const polyline = await rydinexMapsService.getTripPolyline('trip_nonexistent');
  assert.deepEqual(polyline, []);
});

// ─── getLastLocation ─────────────────────────────────────────────────────────

test('getLastLocation returns the most recent location for a driver', async () => {
  resetState();
  savedLocations = [
    { tripId: TRIP_ID, driverId: DRIVER_ID, latitude: 41.878, longitude: -87.629, timestamp: new Date('2026-01-01T10:00:00Z'), speed: 20, heading: 0 },
    { tripId: TRIP_ID, driverId: DRIVER_ID, latitude: 41.890, longitude: -87.640, timestamp: new Date('2026-01-01T11:00:00Z'), speed: 40, heading: 180 },
  ];

  const last = await rydinexMapsService.getLastLocation(DRIVER_ID);
  assert.ok(last, 'Should return a location');
  assert.equal(last.latitude, 41.890);
});

test('getLastLocation returns null when driver has no location history', async () => {
  resetState();
  const last = await rydinexMapsService.getLastLocation('driver_unknown');
  assert.equal(last, null);
});
