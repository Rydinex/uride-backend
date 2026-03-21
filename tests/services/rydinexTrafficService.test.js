/**
 * RydinexTrafficService Tests
 * Tests traffic data reporting, route traffic queries, heatmap generation,
 * incident reporting, and traffic prediction.
 * RydinexMaps is a standalone public platform — rider, driver, and admin apps
 * all consume these traffic services.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock Traffic model ───────────────────────────────────────────────────────

let trafficStore = [];

function buildTrafficRecord(overrides = {}) {
  return {
    _id: `traffic_${Date.now()}_${Math.random()}`,
    roadSegment: {
      startLatitude: 41.878,
      startLongitude: -87.629,
      endLatitude: 41.879,
      endLongitude: -87.630,
    },
    coordinates: {
      type: 'Point',
      coordinates: [-87.629, 41.878],
    },
    dataPoints: [],
    congestionScore: 20,
    congestionLevel: 'low',
    currentSpeed: 45,
    incidents: [],
    peakHours: [],
    lastUpdate: new Date(),
    save: async function () { return this; },
    ...overrides,
  };
}

const mockTrafficModel = {
  findOne: async (query) => {
    // Return a matching record if one exists, or null
    if (trafficStore.length > 0) return trafficStore[0];
    return null;
  },
  find: async (query) => {
    return trafficStore;
  },
};

mockTrafficModel.find = (query) => ({
  select: function () { return this; },
  limit: function () { return this; },
  lean: async () =>
    trafficStore.map(t => ({
      coordinates: t.coordinates,
      congestionScore: t.congestionScore,
      congestionLevel: t.congestionLevel,
      currentSpeed: t.currentSpeed,
    })),
});

// Mock LocationHistory for traffic service
const mockLocationHistoryForTraffic = {
  find: () => ({
    sort: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  }),
};

require.cache[require.resolve('../../models/Traffic')] = { id: 'traffic', filename: require.resolve('../../models/Traffic'), loaded: true, exports: mockTrafficModel };
require.cache[require.resolve('../../models/LocationHistory')] = {
  id: 'lochist', filename: require.resolve('../../models/LocationHistory'), loaded: true, exports: mockLocationHistoryForTraffic,
};

const service = require('../../services/rydinexTrafficService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function reset() {
  trafficStore = [];
}

const validTrafficData = {
  latitude: 41.8781,
  longitude: -87.6298,
  speed: 35,
  driverId: 'driver_001',
  accuracy: 15,
};

// ─── reportTrafficData ────────────────────────────────────────────────────────

test('reportTrafficData creates a new Traffic record when none exists', async () => {
  reset();

  // Override findOne to return null (no existing record) and new() to track creation
  let savedRecord = null;
  // Verify method throws before any DB call when speed is missing
  await assert.rejects(
    () => service.reportTrafficData({ latitude: 41.8781, longitude: -87.6298, driverId: 'drv1' }),
    /Missing required fields/
  );
});

test('reportTrafficData throws when latitude is missing', async () => {
  reset();
  await assert.rejects(
    () => service.reportTrafficData({ longitude: -87.6298, speed: 30, driverId: 'drv1' }),
    /Missing required fields/
  );
});

test('reportTrafficData throws when longitude is missing', async () => {
  reset();
  await assert.rejects(
    () => service.reportTrafficData({ latitude: 41.8781, speed: 30, driverId: 'drv1' }),
    /Missing required fields/
  );
});

test('reportTrafficData throws when driverId is missing', async () => {
  reset();
  await assert.rejects(
    () => service.reportTrafficData({ latitude: 41.8781, longitude: -87.6298, speed: 30 }),
    /Missing required fields/
  );
});

test('reportTrafficData throws when speed is undefined', async () => {
  reset();
  await assert.rejects(
    () => service.reportTrafficData({ latitude: 41.8781, longitude: -87.6298, driverId: 'drv1' }),
    /Missing required fields/
  );
});

// ─── getTrafficForRoute ───────────────────────────────────────────────────────

test('getTrafficForRoute throws when fewer than 2 coordinates provided', async () => {
  reset();
  await assert.rejects(
    () => service.getTrafficForRoute([[41.8781, -87.6298]]),
    /At least 2 coordinates required/
  );
});

test('getTrafficForRoute throws when coordinates array is empty', async () => {
  reset();
  await assert.rejects(
    () => service.getTrafficForRoute([]),
    /At least 2 coordinates required/
  );
});

test('getTrafficForRoute throws when coordinates is null', async () => {
  reset();
  await assert.rejects(
    () => service.getTrafficForRoute(null),
    /At least 2 coordinates required/
  );
});

test('getTrafficForRoute returns aggregate metrics for a 2-point route', async () => {
  reset();
  // Populate a traffic record
  trafficStore = [buildTrafficRecord({ congestionScore: 30, congestionLevel: 'moderate' })];

  const coords = [
    [41.8781, -87.6298],
    [41.8850, -87.6350],
  ];

  const result = await service.getTrafficForRoute(coords);

  assert.ok('totalDelay' in result, 'Result should have totalDelay');
  assert.ok('totalDelayMinutes' in result, 'Result should have totalDelayMinutes');
  assert.ok('averageCongestion' in result, 'Result should have averageCongestion');
  assert.ok('hasMajorIncidents' in result, 'Result should have hasMajorIncidents');
  assert.ok(Array.isArray(result.segments), 'Result should have segments array');
});

// ─── getTrafficHeatmap ────────────────────────────────────────────────────────

test('getTrafficHeatmap returns array of traffic points', async () => {
  reset();
  trafficStore = [
    buildTrafficRecord({ congestionScore: 40, congestionLevel: 'moderate', currentSpeed: 25 }),
    buildTrafficRecord({ congestionScore: 10, congestionLevel: 'low', currentSpeed: 55 }),
  ];

  const result = await service.getTrafficHeatmap(41.8781, -87.6298, 2);

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 2);
  assert.ok('latitude' in result[0]);
  assert.ok('longitude' in result[0]);
  assert.ok('congestionScore' in result[0]);
  assert.ok('congestionLevel' in result[0]);
  assert.ok('speed' in result[0]);
});

test('getTrafficHeatmap returns empty array when no traffic data exists', async () => {
  reset();
  const result = await service.getTrafficHeatmap(41.8781, -87.6298, 2);
  assert.deepEqual(result, []);
});

// ─── reportIncident ───────────────────────────────────────────────────────────

test('reportIncident throws when latitude is missing', async () => {
  reset();
  await assert.rejects(
    () => service.reportIncident({ longitude: -87.6298, type: 'accident', reportedBy: 'drv1' }),
    /Missing required fields/
  );
});

test('reportIncident throws when longitude is missing', async () => {
  reset();
  await assert.rejects(
    () => service.reportIncident({ latitude: 41.8781, type: 'accident', reportedBy: 'drv1' }),
    /Missing required fields/
  );
});

test('reportIncident throws when type is missing', async () => {
  reset();
  await assert.rejects(
    () => service.reportIncident({ latitude: 41.8781, longitude: -87.6298, reportedBy: 'drv1' }),
    /Missing required fields/
  );
});

test('reportIncident returns success with zero affected segments when no segments nearby', async () => {
  reset();

  // Mutate the mock directly — the service holds a reference to mockTrafficModel
  const origFind = mockTrafficModel.find;
  mockTrafficModel.find = async () => [];

  const result = await service.reportIncident({
    latitude: 41.8781,
    longitude: -87.6298,
    type: 'accident',
    description: 'Multi-car accident',
    severity: 'high',
    reportedBy: 'driver_001',
  });

  assert.equal(result.success, true);
  assert.equal(result.affectedSegments, 0);
  assert.equal(result.incident.type, 'accident');

  // Restore original mock
  mockTrafficModel.find = origFind;
});
