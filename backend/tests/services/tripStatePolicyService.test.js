const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateTripStatePolicy,
  __private: { clearPolicyCache },
} = require('../../services/tripStatePolicyService');

const originalPolicyJson = process.env.TRIP_STATE_POLICY_JSON;
const originalPolicyFile = process.env.TRIP_STATE_POLICY_FILE;

function buildPoint({ country = 'US', state = null, city = null, address = '' } = {}) {
  return {
    latitude: 41.8781,
    longitude: -87.6298,
    address,
    ...(country ? { country } : {}),
    ...(state ? { state } : {}),
    ...(city ? { city } : {}),
  };
}

test.beforeEach(() => {
  if (originalPolicyJson === undefined) {
    delete process.env.TRIP_STATE_POLICY_JSON;
  } else {
    process.env.TRIP_STATE_POLICY_JSON = originalPolicyJson;
  }

  if (originalPolicyFile === undefined) {
    delete process.env.TRIP_STATE_POLICY_FILE;
  } else {
    process.env.TRIP_STATE_POLICY_FILE = originalPolicyFile;
  }

  clearPolicyCache();
});

test.after(() => {
  if (originalPolicyJson === undefined) {
    delete process.env.TRIP_STATE_POLICY_JSON;
  } else {
    process.env.TRIP_STATE_POLICY_JSON = originalPolicyJson;
  }

  if (originalPolicyFile === undefined) {
    delete process.env.TRIP_STATE_POLICY_FILE;
  } else {
    process.env.TRIP_STATE_POLICY_FILE = originalPolicyFile;
  }

  clearPolicyCache();
});

test('Illinois allows all configured ride categories for pickups', () => {
  const result = evaluateTripStatePolicy({
    pickup: buildPoint({ state: 'IL' }),
    dropoff: buildPoint({ state: 'IL' }),
    rideCategory: 'suv',
    isPrearranged: false,
  });

  assert.equal(result.isAllowed, true);
  assert.equal(result.pickupCountryCode, 'US');
  assert.equal(result.pickupStateCode, 'IL');
  assert.equal(result.violations.length, 0);
});

test('Indiana black_suv pickups must be pre-arranged', () => {
  const result = evaluateTripStatePolicy({
    pickup: buildPoint({ state: 'IN' }),
    dropoff: buildPoint({ state: 'IL' }),
    rideCategory: 'suv',
    isPrearranged: false,
  });

  assert.equal(result.isAllowed, false);
  assert.ok(result.violations.some(violation => violation.code === 'pickup_requires_prearranged'));
});

test('Wisconsin black_car pickups require pre-arranged trips', () => {
  const result = evaluateTripStatePolicy({
    pickup: buildPoint({ state: 'WI' }),
    dropoff: buildPoint({ state: 'IL' }),
    rideCategory: 'black_car',
    isPrearranged: false,
  });

  assert.equal(result.isAllowed, false);
  assert.ok(result.violations.some(violation => violation.code === 'pickup_requires_prearranged'));
});

test('All US states are available by default (example: California)', () => {
  const result = evaluateTripStatePolicy({
    pickup: buildPoint({ state: 'CA' }),
    dropoff: buildPoint({ state: 'NV' }),
    rideCategory: 'suv',
    isPrearranged: false,
  });

  assert.equal(result.isAllowed, true);
  assert.equal(result.pickupStateCode, 'CA');
  assert.equal(result.dropoffStateCode, 'NV');
});

test('State can be inferred from address when point.state is not present', () => {
  const result = evaluateTripStatePolicy({
    pickup: buildPoint({ address: '123 Main St, Milwaukee, WI 53202' }),
    dropoff: buildPoint({ state: 'IL' }),
    rideCategory: 'black_car',
    isPrearranged: false,
  });

  assert.equal(result.pickupStateCode, 'WI');
  assert.equal(result.pickupStateSource, 'address');
  assert.equal(result.isAllowed, false);
  assert.ok(result.violations.some(violation => violation.code === 'pickup_requires_prearranged'));
});

test('Legacy root-level states config remains supported', () => {
  process.env.TRIP_STATE_POLICY_JSON = JSON.stringify({
    version: 'dynamic-legacy-v1',
    defaultStateCode: 'IL',
    states: {
      MI: {
        name: 'Michigan',
        pickup: {
          allow: true,
          allowedRideCategories: ['suv'],
          requirePrearranged: false,
        },
        dropoff: {
          allow: true,
          allowedRideCategories: null,
          requirePrearranged: false,
        },
      },
    },
  });

  clearPolicyCache();

  const suvPickup = evaluateTripStatePolicy({
    pickup: buildPoint({ state: 'MI' }),
    dropoff: buildPoint({ state: 'IL' }),
    rideCategory: 'suv',
    isPrearranged: false,
  });

  const blackCarPickup = evaluateTripStatePolicy({
    pickup: buildPoint({ state: 'MI' }),
    dropoff: buildPoint({ state: 'IL' }),
    rideCategory: 'black_car',
    isPrearranged: false,
  });

  assert.equal(suvPickup.isAllowed, true);
  assert.equal(suvPickup.policyVersion, 'dynamic-legacy-v1');
  assert.equal(suvPickup.policySource, 'env');

  assert.equal(blackCarPickup.isAllowed, false);
  assert.ok(blackCarPickup.violations.some(violation => violation.code === 'pickup_category_not_allowed'));
});

test('Future countries can be added dynamically', () => {
  process.env.TRIP_STATE_POLICY_JSON = JSON.stringify({
    version: 'dynamic-global-v1',
    defaultCountryCode: 'US',
    countries: {
      FR: {
        name: 'France',
        defaultRule: {
          pickup: {
            allow: true,
            allowedRideCategories: ['black_car'],
            requirePrearranged: false,
          },
          dropoff: {
            allow: true,
            allowedRideCategories: null,
            requirePrearranged: false,
          },
        },
      },
    },
  });

  clearPolicyCache();

  const blackCarInFrance = evaluateTripStatePolicy({
    pickup: buildPoint({ country: 'FR', city: 'Paris' }),
    dropoff: buildPoint({ country: 'FR', city: 'Paris' }),
    rideCategory: 'black_car',
    isPrearranged: false,
  });

  const suvInFrance = evaluateTripStatePolicy({
    pickup: buildPoint({ country: 'FR', city: 'Paris' }),
    dropoff: buildPoint({ country: 'FR', city: 'Paris' }),
    rideCategory: 'suv',
    isPrearranged: false,
  });

  assert.equal(blackCarInFrance.isAllowed, true);
  assert.equal(blackCarInFrance.pickupCountryCode, 'FR');

  assert.equal(suvInFrance.isAllowed, false);
  assert.ok(suvInFrance.violations.some(violation => violation.code === 'pickup_category_not_allowed'));
});

test('Future city overrides can be added dynamically', () => {
  process.env.TRIP_STATE_POLICY_JSON = JSON.stringify({
    version: 'dynamic-city-v1',
    defaultCountryCode: 'US',
    countries: {
      US: {
        cities: {
          CHICAGO: {
            name: 'Chicago',
            stateCode: 'IL',
            pickup: {
              allow: true,
              allowedRideCategories: ['black_car'],
              requirePrearranged: true,
            },
            dropoff: {
              allow: true,
              allowedRideCategories: null,
              requirePrearranged: false,
            },
          },
        },
      },
    },
  });

  clearPolicyCache();

  const chicagoWalkup = evaluateTripStatePolicy({
    pickup: buildPoint({ country: 'US', state: 'IL', city: 'Chicago' }),
    dropoff: buildPoint({ country: 'US', state: 'IL', city: 'Chicago' }),
    rideCategory: 'black_car',
    isPrearranged: false,
  });

  const chicagoPrearranged = evaluateTripStatePolicy({
    pickup: buildPoint({ country: 'US', state: 'IL', city: 'Chicago' }),
    dropoff: buildPoint({ country: 'US', state: 'IL', city: 'Chicago' }),
    rideCategory: 'black_car',
    isPrearranged: true,
  });

  assert.equal(chicagoWalkup.isAllowed, false);
  assert.ok(chicagoWalkup.violations.some(violation => violation.code === 'pickup_requires_prearranged'));

  assert.equal(chicagoPrearranged.isAllowed, true);
});
