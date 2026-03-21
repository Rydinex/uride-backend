/**
 * RydinexGeocodingService Tests
 * Tests geocoding (address→coords), reverse geocoding (coords→address),
 * batch operations, and autocomplete.
 * RydinexMaps is a standalone public platform — rider, driver, and admin apps
 * all consume these geocoding services.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock axios ───────────────────────────────────────────────────────────────

let mockGeoAxiosResponse = null;
let lastGeoAxiosUrl = null;

const mockGeoAxios = {
  get: async (url, config = {}) => {
    lastGeoAxiosUrl = url;
    if (mockGeoAxiosResponse instanceof Error) throw mockGeoAxiosResponse;
    return { data: mockGeoAxiosResponse };
  },
};

// Mock Geocode model (caching in DB)
const mockGeocodeModel = {
  findOne: async () => null,         // No cache by default
  create: async (data) => data,
};

// Inject mocks into require cache before loading service
require.cache[require.resolve('axios')] = { id: 'axios', filename: require.resolve('axios'), loaded: true, exports: mockGeoAxios };
require.cache[require.resolve('../../models/Geocode')] = { id: 'geocode', filename: require.resolve('../../models/Geocode'), loaded: true, exports: mockGeocodeModel };

const service = require('../../services/rydinexGeocodingService');

// Disable cache and rate-limit delay for tests
service.useCache = false;
service.requestDelay = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildNominatimResult(overrides = {}) {
  return [
    {
      place_id: 12345,
      lat: '41.8781136',
      lon: '-87.6297982',
      display_name: '222 W Merchandise Mart Plaza, Chicago, Illinois, United States',
      address: {
        road: 'W Merchandise Mart Plaza',
        city: 'Chicago',
        state: 'Illinois',
        country: 'United States',
        country_code: 'us',
        postcode: '60654',
      },
      type: 'building',
      importance: 0.9,
      ...overrides,
    },
  ];
}

function buildNominatimReverseResult(overrides = {}) {
  return {
    place_id: 99999,
    lat: '41.8781',
    lon: '-87.6298',
    display_name: '233 S Wacker Dr, Chicago, Illinois, United States',
    address: {
      road: 'S Wacker Dr',
      city: 'Chicago',
      state: 'Illinois',
      country: 'United States',
      country_code: 'us',
      postcode: '60606',
    },
    type: 'office',
    importance: 0.85,
    ...overrides,
  };
}

// ─── geocodeAddress ───────────────────────────────────────────────────────────

test('geocodeAddress returns coordinates for a valid address', async () => {
  mockGeoAxiosResponse = buildNominatimResult();

  const result = await service.geocodeAddress('222 W Merchandise Mart Plaza, Chicago');

  assert.equal(result.success, true);
  assert.equal(result.source, 'nominatim');
  assert.ok(result.count > 0);
  assert.ok(Array.isArray(result.results));

  const top = result.results[0];
  assert.ok(typeof top.latitude === 'number' || typeof top.latitude === 'string');
  assert.ok(typeof top.longitude === 'number' || typeof top.longitude === 'string');
});

test('geocodeAddress calls Nominatim search endpoint', async () => {
  mockGeoAxiosResponse = buildNominatimResult();

  await service.geocodeAddress('Chicago City Hall');

  assert.ok(lastGeoAxiosUrl.includes('/search'), 'Should call /search endpoint');
});

test('geocodeAddress throws when address is empty string', async () => {
  await assert.rejects(
    () => service.geocodeAddress(''),
    /Address is required/
  );
});

test('geocodeAddress throws when address is only whitespace', async () => {
  await assert.rejects(
    () => service.geocodeAddress('   '),
    /Address is required/
  );
});

test('geocodeAddress throws when Nominatim returns no results', async () => {
  mockGeoAxiosResponse = []; // Empty results

  await assert.rejects(
    () => service.geocodeAddress('xyznonexistentplace123'),
    /No results found/
  );
});

test('geocodeAddress throws when axios fails', async () => {
  mockGeoAxiosResponse = new Error('Connection refused');

  await assert.rejects(
    () => service.geocodeAddress('123 Main St'),
    /Connection refused/
  );
});

// ─── reverseGeocode ───────────────────────────────────────────────────────────

test('reverseGeocode returns address for valid coordinates', async () => {
  mockGeoAxiosResponse = buildNominatimReverseResult();

  const result = await service.reverseGeocode(41.8781, -87.6298);

  assert.equal(result.success, true);
  assert.ok(result.result, 'Should have a result property');
});

test('reverseGeocode calls Nominatim reverse endpoint', async () => {
  mockGeoAxiosResponse = buildNominatimReverseResult();

  await service.reverseGeocode(41.8781, -87.6298);

  assert.ok(lastGeoAxiosUrl.includes('/reverse'), 'Should call /reverse endpoint');
});

test('reverseGeocode throws when latitude is null', async () => {
  await assert.rejects(
    () => service.reverseGeocode(null, -87.6298),
    /Latitude and longitude are required/
  );
});

test('reverseGeocode throws when longitude is null', async () => {
  await assert.rejects(
    () => service.reverseGeocode(41.8781, null),
    /Latitude and longitude are required/
  );
});

// ─── batchGeocode ─────────────────────────────────────────────────────────────

test('batchGeocode processes multiple addresses and returns results array', async () => {
  mockGeoAxiosResponse = buildNominatimResult();

  const addresses = ['111 N State St, Chicago', '233 S Wacker Dr, Chicago'];
  const results = await service.batchGeocode(addresses);

  assert.equal(results.length, 2);
  assert.ok(results[0].address === addresses[0]);
  assert.equal(results[0].success, true);
});

test('batchGeocode marks individual failed addresses as failed without throwing', async () => {
  let callCount = 0;
  mockGeoAxios.get = async (url) => {
    lastGeoAxiosUrl = url;
    callCount++;
    if (callCount === 1) return { data: buildNominatimResult() };
    return { data: [] }; // Second call returns empty → throws inside service
  };

  const addresses = ['111 N State St, Chicago', 'xyzinvalidaddress999'];
  const results = await service.batchGeocode(addresses);

  assert.equal(results.length, 2);
  assert.equal(results[0].success, true);
  assert.equal(results[1].success, false);
  assert.ok(results[1].error);
});

test('batchGeocode throws when addresses array is empty', async () => {
  await assert.rejects(
    () => service.batchGeocode([]),
    /Addresses array is required/
  );
});

test('batchGeocode throws when more than 50 addresses are provided', async () => {
  const tooMany = Array.from({ length: 51 }, (_, i) => `Address ${i}`);

  await assert.rejects(
    () => service.batchGeocode(tooMany),
    /Maximum 50 addresses per batch/
  );
});

// ─── autocomplete ─────────────────────────────────────────────────────────────

test('autocomplete returns empty array when query is shorter than 3 characters', async () => {
  const result = await service.autocomplete('Ch');
  assert.deepEqual(result, []);
});

test('autocomplete returns empty array for empty string', async () => {
  const result = await service.autocomplete('');
  assert.deepEqual(result, []);
});

test('autocomplete returns suggestions for 3+ character query', async () => {
  mockGeoAxios.get = async (url) => {
    lastGeoAxiosUrl = url;
    return { data: buildNominatimResult() };
  };

  const result = await service.autocomplete('Chi');
  assert.ok(Array.isArray(result));
});
