/**
 * RydinexAIPoiService Tests
 * Tests nearby POI discovery, route-based recommendations, POI search,
 * emergency services lookup, and AI relevance scoring.
 * RydinexMaps is a standalone public platform — rider, driver, and admin apps
 * all consume these POI services.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock POI model ───────────────────────────────────────────────────────────

let poiStore = [];

function buildPOI(overrides = {}) {
  return {
    _id: `poi_${Date.now()}_${Math.random()}`,
    name: 'Test Café',
    category: 'restaurant',
    latitude: 41.8781,
    longitude: -87.6298,
    rating: 4.5,
    isOpen: true,
    visits: 500,
    reviewCount: 80,
    aiTags: ['recommended', 'popular'],
    priceLevel: 2,
    ...overrides,
  };
}

const mockPOIModel = {
  find: (query) => {
    let results = poiStore.filter(p => {
      if (query.isOpen !== undefined && p.isOpen !== query.isOpen) return false;
      if (query.category && p.category !== query.category) return false;
      return true;
    });

    return {
      limit: (n) => ({
        lean: async () => results.slice(0, n),
      }),
      sort: () => ({
        limit: (n) => ({
          lean: async () => results.slice(0, n),
        }),
      }),
    };
  },
  findByIdAndUpdate: async () => null,
};

require.cache[require.resolve('../../models/POI')] = { id: 'poi', filename: require.resolve('../../models/POI'), loaded: true, exports: mockPOIModel };

const service = require('../../services/rydinexAIPoiService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function reset() {
  poiStore = [];
}

const CENTER_LAT = 41.8781;
const CENTER_LON = -87.6298;

// ─── findNearbyPOI ────────────────────────────────────────────────────────────

test('findNearbyPOI returns POI within radius', async () => {
  reset();
  poiStore = [
    buildPOI({ name: 'Nearby Café', latitude: 41.8785, longitude: -87.6300 }),
    buildPOI({ name: 'Far Away Diner', latitude: 42.0000, longitude: -88.0000 }),
  ];

  const result = await service.findNearbyPOI(CENTER_LAT, CENTER_LON, 2);

  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
  // Should have relevanceScore added
  assert.ok('relevanceScore' in result[0]);
  assert.ok('distance' in result[0]);
});

test('findNearbyPOI returns empty array when no POI exist', async () => {
  reset();
  const result = await service.findNearbyPOI(CENTER_LAT, CENTER_LON, 2);
  assert.deepEqual(result, []);
});

test('findNearbyPOI filters by category when provided', async () => {
  reset();
  poiStore = [
    buildPOI({ name: 'Good Coffee', category: 'cafe' }),
    buildPOI({ name: 'Burger Joint', category: 'restaurant' }),
  ];

  const result = await service.findNearbyPOI(CENTER_LAT, CENTER_LON, 5, { category: 'cafe' });

  assert.ok(result.every(p => p.category === 'cafe'), 'All results should match category filter');
});

test('findNearbyPOI sorts by relevanceScore when aiSmart is true', async () => {
  reset();
  poiStore = [
    buildPOI({ name: 'Low Score', rating: 1.0, visits: 5, reviewCount: 1, aiTags: [] }),
    buildPOI({ name: 'High Score', rating: 5.0, visits: 2000, reviewCount: 200, aiTags: ['recommended', 'popular'] }),
  ];

  const result = await service.findNearbyPOI(CENTER_LAT, CENTER_LON, 10, { aiSmart: true });

  assert.ok(result.length >= 2);
  // High relevance should come first
  assert.ok(result[0].relevanceScore >= result[1].relevanceScore);
});

// ─── getRouteRecommendations ──────────────────────────────────────────────────

test('getRouteRecommendations returns deduped POI along route', async () => {
  reset();
  poiStore = [
    buildPOI({ name: 'Route Stop A', rating: 4.0, visits: 300, reviewCount: 50 }),
  ];

  const routePoints = [
    [41.8781, -87.6298],
    [41.8850, -87.6350],
    [41.8900, -87.6400],
  ];

  const result = await service.getRouteRecommendations(routePoints);

  assert.ok(Array.isArray(result));
  // No duplicate names
  const names = result.map(r => r.name);
  const uniqueNames = [...new Set(names)];
  assert.equal(names.length, uniqueNames.length, 'Should not have duplicate POI names');
});

test('getRouteRecommendations returns empty array when no POI exist', async () => {
  reset();
  const routePoints = [[41.8781, -87.6298], [41.8850, -87.6350]];
  const result = await service.getRouteRecommendations(routePoints);
  assert.deepEqual(result, []);
});

// ─── searchPOI ────────────────────────────────────────────────────────────────

test('searchPOI returns matching POI for a search term', async () => {
  reset();
  poiStore = [
    buildPOI({ name: 'Chicago Deep Dish Pizza', category: 'restaurant' }),
    buildPOI({ name: 'Millennium Park Café', category: 'cafe' }),
  ];

  const result = await service.searchPOI('Pizza');

  assert.ok(Array.isArray(result));
});

test('searchPOI returns all open POI when no search term provided', async () => {
  reset();
  poiStore = [
    buildPOI({ name: 'Open Place', isOpen: true }),
    buildPOI({ name: 'Closed Place', isOpen: false }),
  ];

  const result = await service.searchPOI('');

  assert.ok(result.every(p => p.isOpen !== false));
});

// ─── getEmergencyServices ─────────────────────────────────────────────────────

test('getEmergencyServices returns POI results', async () => {
  reset();
  poiStore = [
    buildPOI({ name: 'Cook County Hospital', category: 'hospital', rating: 4.8 }),
    buildPOI({ name: 'CPD District 1', category: 'police', rating: 3.5 }),
  ];

  const result = await service.getEmergencyServices(CENTER_LAT, CENTER_LON, 5);

  assert.ok(Array.isArray(result));
});

// ─── getPOIByCategory ─────────────────────────────────────────────────────────

test('getPOIByCategory returns POI filtered by category', async () => {
  reset();
  poiStore = [
    buildPOI({ name: 'Hotel Alpha', category: 'hotel' }),
    buildPOI({ name: 'Cafe Beta', category: 'cafe' }),
  ];

  const result = await service.getPOIByCategory('hotel');

  assert.ok(Array.isArray(result));
  assert.ok(result.every(p => p.category === 'hotel'));
});

// ─── _calculateRelevanceScore (private / unit) ─────────────────────────────

test('_calculateRelevanceScore returns 0 for a low-quality POI', () => {
  const poi = buildPOI({ rating: 0, visits: 0, reviewCount: 0, aiTags: [], priceLevel: 3 });
  const score = service._calculateRelevanceScore(poi);
  assert.equal(score, 0);
});

test('_calculateRelevanceScore returns higher score for a popular POI', () => {
  const lowPOI = buildPOI({ rating: 1.0, visits: 0, reviewCount: 0, aiTags: [], priceLevel: 3 });
  const highPOI = buildPOI({ rating: 5.0, visits: 5000, reviewCount: 500, aiTags: ['recommended', 'popular'], priceLevel: 1 });

  const lowScore = service._calculateRelevanceScore(lowPOI);
  const highScore = service._calculateRelevanceScore(highPOI);

  assert.ok(highScore > lowScore, `High POI score (${highScore}) should exceed low (${lowScore})`);
});

test('_calculateRelevanceScore caps at 100', () => {
  const poi = buildPOI({ rating: 5.0, visits: 999999, reviewCount: 99999, aiTags: ['recommended', 'popular', 'emergency'], priceLevel: 1 });
  const score = service._calculateRelevanceScore(poi);
  assert.ok(score <= 100, `Score (${score}) should not exceed 100`);
});

// ─── _calculateDistance (private / unit) ──────────────────────────────────────

test('_calculateDistance returns 0 for identical points', () => {
  const dist = service._calculateDistance(41.8781, -87.6298, 41.8781, -87.6298);
  assert.equal(dist, 0);
});

test('_calculateDistance returns a positive number for two different points', () => {
  const dist = service._calculateDistance(41.8781, -87.6298, 41.8850, -87.6350);
  assert.ok(dist > 0, 'Distance should be positive');
  assert.ok(dist < 5, 'Distance between close Chicago points should be < 5km');
});
