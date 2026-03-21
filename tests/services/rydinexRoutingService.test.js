/**
 * RydinexRoutingService Tests
 * Tests routing calculations, distance queries, and distance matrix.
 * RydinexMaps is a standalone public platform — rider app, driver app, and admin
 * all connect to these same backend routing services.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock axios ───────────────────────────────────────────────────────────────

let mockAxiosResponse = null;
let lastAxiosUrl = null;
let lastAxiosParams = null;

const mockAxios = {
  get: async (url, config = {}) => {
    lastAxiosUrl = url;
    lastAxiosParams = config.params || {};
    if (mockAxiosResponse instanceof Error) throw mockAxiosResponse;
    return { data: mockAxiosResponse };
  },
};

// Stub @mapbox/polyline
const mockPolyline = {
  decode: (encoded) => [[41.878, -87.629], [41.879, -87.630]],
  encode: (points) => 'mockEncodedPolyline',
};

// Patch require cache before loading service
require.cache[require.resolve('axios')] = { id: 'axios', filename: require.resolve('axios'), loaded: true, exports: mockAxios };
require.cache[require.resolve('@mapbox/polyline')] = { id: 'polyline', filename: require.resolve('@mapbox/polyline'), loaded: true, exports: mockPolyline };
require.cache[require.resolve('../../models/Route')] = { id: 'route', filename: require.resolve('../../models/Route'), loaded: true, exports: {} };

const service = require('../../services/rydinexRoutingService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildOsrmRouteResponse(distanceM = 5000, durationS = 600) {
  return {
    code: 'Ok',
    routes: [
      {
        distance: distanceM,
        duration: durationS,
        geometry: { type: 'LineString', coordinates: [[-87.629, 41.878], [-87.630, 41.879]] },
        legs: [
          {
            distance: distanceM,
            duration: durationS,
            steps: [
              {
                maneuver: { type: 'depart', instruction: 'Head north', location: [-87.629, 41.878] },
                distance: distanceM,
                duration: durationS,
                name: 'Main St',
              },
            ],
          },
        ],
      },
    ],
    waypoints: [
      { location: [-87.629, 41.878], name: 'Pickup' },
      { location: [-87.630, 41.879], name: 'Dropoff' },
    ],
  };
}

const pickup = { latitude: 41.8781, longitude: -87.6298, name: 'Pickup' };
const dropoff = { latitude: 41.8850, longitude: -87.6350, name: 'Dropoff' };

// ─── calculateRoute ───────────────────────────────────────────────────────────

test('calculateRoute returns valid route object for 2 waypoints', async () => {
  mockAxiosResponse = buildOsrmRouteResponse(5000, 600);

  const result = await service.calculateRoute([pickup, dropoff]);

  assert.equal(result.success, true);
  assert.ok(typeof result.totalDistance === 'number');
  assert.ok(result.totalDistance > 0, 'Distance should be greater than 0');
  assert.equal(result.totalDistance, 5); // 5000m → 5km
  assert.ok(typeof result.totalDurationMinutes === 'number');
  assert.equal(result.totalDurationMinutes, 10); // 600s → 10min
  // _calculateETA returns {originalEta, currentEta, estimatedArrivalTime}
  assert.ok(result.eta.originalEta instanceof Date);
  assert.ok(Array.isArray(result.segments));
  assert.ok(Array.isArray(result.waypoints));
});

test('calculateRoute throws when fewer than 2 waypoints provided', async () => {
  await assert.rejects(
    () => service.calculateRoute([pickup]),
    /At least 2 waypoints required/
  );
});

test('calculateRoute throws when waypoints is empty', async () => {
  await assert.rejects(
    () => service.calculateRoute([]),
    /At least 2 waypoints required/
  );
});

test('calculateRoute throws when waypoints is null', async () => {
  await assert.rejects(
    () => service.calculateRoute(null),
    /At least 2 waypoints required/
  );
});

test('calculateRoute throws when OSRM returns error code', async () => {
  mockAxiosResponse = { code: 'NoRoute', message: 'No route found' };

  await assert.rejects(
    () => service.calculateRoute([pickup, dropoff]),
    /OSRM error/
  );
});

test('calculateRoute throws when axios fails', async () => {
  mockAxiosResponse = new Error('Network timeout');

  await assert.rejects(
    () => service.calculateRoute([pickup, dropoff]),
    /Network timeout/
  );
});

// ─── getDistance ──────────────────────────────────────────────────────────────

test('getDistance returns distance and duration between two points', async () => {
  mockAxiosResponse = buildOsrmRouteResponse(3200, 360);

  const result = await service.getDistance(
    pickup.latitude, pickup.longitude,
    dropoff.latitude, dropoff.longitude
  );

  assert.ok(typeof result.distance === 'number');
  assert.equal(result.distance, 3.2); // 3200m → 3.2km
  assert.equal(result.durationMinutes, 6); // 360s → 6min
  assert.ok(result.eta instanceof Date);
});

test('getDistance passes correct coordinates to OSRM', async () => {
  mockAxiosResponse = buildOsrmRouteResponse(1000, 120);

  await service.getDistance(41.8781, -87.6298, 41.8850, -87.6350);

  // JS drops trailing zeros: -87.6350 → -87.635, 41.8850 → 41.885
  assert.ok(lastAxiosUrl.includes('-87.635,41.885'));
});

// ─── getDistanceMatrix ────────────────────────────────────────────────────────

test('getDistanceMatrix returns durations and distances matrix', async () => {
  mockAxiosResponse = {
    code: 'Ok',
    durations: [[0, 600], [660, 0]],
    distances: [[0, 5000], [5200, 0]],
  };

  const locations = [
    { latitude: 41.8781, longitude: -87.6298 },
    { latitude: 41.8850, longitude: -87.6350 },
  ];

  const result = await service.getDistanceMatrix(locations);

  assert.ok(Array.isArray(result.durations));
  assert.equal(result.durations.length, 2);
  assert.equal(result.durations[0][1], 600);
  assert.ok(Array.isArray(result.distances));
});

test('getDistanceMatrix uses table endpoint', async () => {
  mockAxiosResponse = {
    code: 'Ok',
    durations: [[0, 600], [660, 0]],
    distances: [[0, 5000], [5200, 0]],
  };

  await service.getDistanceMatrix([
    { latitude: 41.8781, longitude: -87.6298 },
    { latitude: 41.8850, longitude: -87.6350 },
  ]);

  assert.ok(lastAxiosUrl.includes('/table/v1/'));
});
