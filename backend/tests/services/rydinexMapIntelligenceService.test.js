/**
 * RydinexMapIntelligenceService Tests
 * Tests route intelligence aggregation, smart pickup points, urban zone warnings,
 * parking info, speed limits, and risky location detection.
 * RydinexMaps is a standalone public platform — rider, driver, and admin apps
 * all consume these map intelligence services.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock MapIntelligence model ───────────────────────────────────────────────

let intelStore = [];

function buildIntel(overrides = {}) {
  return {
    _id: `intel_${Date.now()}_${Math.random()}`,
    coordinates: {
      type: 'Point',
      coordinates: [-87.6298, 41.8781], // [lon, lat]
    },
    roadSegment: {
      roadName: 'W Adams St',
      speedLimit: 50,
      laneCount: 2,
      roadType: 'urban',
    },
    urbanRules: {
      isPickupZone: true,
      isSchoolZone: false,
      isCongestionChargingZone: false,
      isEnvironmentalZone: false,
      restrictions: null,
    },
    safetyData: {
      riskLevel: 'low_risk',
      accidentCount: 2,
      fatalAccidents: 0,
    },
    parkingData: {
      nearbyParkingZones: ['Zone A', 'Zone B'],
      curbsideRules: ['No stopping 7am-9am'],
    },
    peakHours: [
      { hour: 8, averageSpeed: 20, congestionLevel: 'heavy', frequency: 30 },
      { hour: 17, averageSpeed: 15, congestionLevel: 'severe', frequency: 25 },
    ],
    ...overrides,
  };
}

const mockMapIntelligenceModel = {
  // Returns a Mongoose Query mock — thenable AND supports .select().lean() chains
  findOne: (query) => {
    const record = intelStore.length > 0 ? intelStore[0] : null;
    const q = {
      select: function () { return this; },
      lean: function () { return this; },
      then: function (resolve, reject) {
        return Promise.resolve(record).then(resolve, reject);
      },
      catch: function (onRejected) {
        return Promise.resolve(record).catch(onRejected);
      },
    };
    return q;
  },
  find: (query) => ({
    select: function () { return this; },
    limit: function () { return this; },
    lean: async () => intelStore,
  }),
};

require.cache[require.resolve('../../models/MapIntelligence')] = {
  id: 'mapintel', filename: require.resolve('../../models/MapIntelligence'), loaded: true, exports: mockMapIntelligenceModel,
};

const service = require('../../services/rydinexMapIntelligenceService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function reset() {
  intelStore = [];
}

const LAT = 41.8781;
const LON = -87.6298;

// ─── getRouteIntelligence ─────────────────────────────────────────────────────

test('getRouteIntelligence throws when fewer than 2 coordinates provided', async () => {
  reset();
  await assert.rejects(
    () => service.getRouteIntelligence([[LAT, LON]]),
    /At least 2 coordinates required/
  );
});

test('getRouteIntelligence throws when coordinates array is empty', async () => {
  reset();
  await assert.rejects(
    () => service.getRouteIntelligence([]),
    /At least 2 coordinates required/
  );
});

test('getRouteIntelligence throws when coordinates is null', async () => {
  reset();
  await assert.rejects(
    () => service.getRouteIntelligence(null),
    /At least 2 coordinates required/
  );
});

test('getRouteIntelligence returns aggregated intelligence for a 2-coord route', async () => {
  reset();
  intelStore = [buildIntel()];

  const result = await service.getRouteIntelligence([
    [LAT, LON],
    [41.8850, -87.6350],
  ]);

  assert.ok(result !== null && result !== undefined);
  // Should be an aggregated object (not null)
  assert.ok(typeof result === 'object');
});

test('getRouteIntelligence returns result when no intelligence data exists', async () => {
  reset();
  // No intel records — service should still return without throwing
  const result = await service.getRouteIntelligence([
    [LAT, LON],
    [41.8850, -87.6350],
  ]);
  assert.ok(result !== undefined);
});

// ─── getSmartPickupPoints ─────────────────────────────────────────────────────

test('getSmartPickupPoints returns pickup zones near a location', async () => {
  reset();
  intelStore = [
    buildIntel({ urbanRules: { isPickupZone: true } }),
    buildIntel({ urbanRules: { isPickupZone: true }, roadSegment: { roadName: 'N Michigan Ave', speedLimit: 40 } }),
  ];

  const result = await service.getSmartPickupPoints(LAT, LON);

  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.ok('latitude' in result[0]);
  assert.ok('longitude' in result[0]);
  assert.ok('isLegal' in result[0]);
});

test('getSmartPickupPoints returns empty array when no pickup zones found', async () => {
  reset();
  const result = await service.getSmartPickupPoints(LAT, LON);
  assert.deepEqual(result, []);
});

// ─── getUrbanZoneWarnings ─────────────────────────────────────────────────────

test('getUrbanZoneWarnings returns empty array when no intel exists', async () => {
  reset();
  const result = await service.getUrbanZoneWarnings(LAT, LON);
  assert.deepEqual(result, []);
});

test('getUrbanZoneWarnings returns school zone warning when flagged', async () => {
  reset();
  intelStore = [buildIntel({
    urbanRules: {
      isSchoolZone: true,
      schoolZoneHours: '7am-4pm weekdays',
      isCongestionChargingZone: false,
      isEnvironmentalZone: false,
    },
    safetyData: { riskLevel: 'low_risk', accidentCount: 1 },
  })];

  const result = await service.getUrbanZoneWarnings(LAT, LON);

  assert.ok(result.some(w => w.type === 'school_zone'), 'Should include a school_zone warning');
  const schoolWarning = result.find(w => w.type === 'school_zone');
  assert.ok(schoolWarning.message.includes('School zone'));
});

test('getUrbanZoneWarnings returns congestion charge warning when flagged', async () => {
  reset();
  intelStore = [buildIntel({
    urbanRules: {
      isSchoolZone: false,
      isCongestionChargingZone: true,
      congestionChargingHours: '7am-10pm',
      isEnvironmentalZone: false,
    },
    safetyData: { riskLevel: 'low_risk', accidentCount: 0 },
  })];

  const result = await service.getUrbanZoneWarnings(LAT, LON);

  assert.ok(result.some(w => w.type === 'congestion_charge'), 'Should include a congestion_charge warning');
});

test('getUrbanZoneWarnings returns safety warning for high risk zones', async () => {
  reset();
  intelStore = [buildIntel({
    urbanRules: { isSchoolZone: false, isCongestionChargingZone: false, isEnvironmentalZone: false },
    safetyData: { riskLevel: 'high_risk', accidentCount: 42, fatalAccidents: 3 },
  })];

  const result = await service.getUrbanZoneWarnings(LAT, LON);

  assert.ok(result.some(w => w.type === 'safety_warning'), 'Should include a safety_warning');
});

test('getUrbanZoneWarnings returns no warnings for a safe normal zone', async () => {
  reset();
  intelStore = [buildIntel({
    urbanRules: { isSchoolZone: false, isCongestionChargingZone: false, isEnvironmentalZone: false },
    safetyData: { riskLevel: 'low_risk', accidentCount: 1 },
  })];

  const result = await service.getUrbanZoneWarnings(LAT, LON);

  assert.deepEqual(result, []);
});

// ─── getParkingInformation ────────────────────────────────────────────────────

test('getParkingInformation returns parking zones and curbside rules', async () => {
  reset();
  intelStore = [buildIntel()];

  const result = await service.getParkingInformation(LAT, LON);

  assert.ok(Array.isArray(result.nearbyParkingZones));
  assert.ok(Array.isArray(result.curbsideRules));
  assert.ok(result.nearbyParkingZones.length > 0);
});

test('getParkingInformation returns empty zones when no intel exists', async () => {
  reset();
  const result = await service.getParkingInformation(LAT, LON);

  assert.deepEqual(result.nearbyParkingZones, []);
  assert.deepEqual(result.curbsideRules, []);
});

// ─── getSpeedLimit ────────────────────────────────────────────────────────────

test('getSpeedLimit returns configured speed limit', async () => {
  reset();
  intelStore = [buildIntel({ roadSegment: { speedLimit: 60 }, urbanRules: { isSchoolZone: false } })];

  const limit = await service.getSpeedLimit(LAT, LON);

  assert.equal(limit, 60);
});

test('getSpeedLimit returns halved speed limit in school zone', async () => {
  reset();
  intelStore = [buildIntel({
    roadSegment: { speedLimit: 50 },
    urbanRules: { isSchoolZone: true },
  })];

  const limit = await service.getSpeedLimit(LAT, LON);

  assert.equal(limit, 25); // 50 * 0.5
});

test('getSpeedLimit returns default 50 when no intel exists', async () => {
  reset();
  const limit = await service.getSpeedLimit(LAT, LON);
  assert.equal(limit, 50);
});

// ─── getRiskyLocations ────────────────────────────────────────────────────────

test('getRiskyLocations returns high-risk locations', async () => {
  reset();
  intelStore = [
    buildIntel({ safetyData: { riskLevel: 'high_risk', accidentCount: 15, fatalAccidents: 2 } }),
    buildIntel({ safetyData: { riskLevel: 'extreme_risk', accidentCount: 30, fatalAccidents: 5 } }),
  ];

  const result = await service.getRiskyLocations(LAT, LON, 2);

  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  assert.ok('riskLevel' in result[0]);
  assert.ok('accidentCount' in result[0]);
});

test('getRiskyLocations returns empty array when no risky areas found', async () => {
  reset();
  const result = await service.getRiskyLocations(LAT, LON, 2);
  assert.deepEqual(result, []);
});
