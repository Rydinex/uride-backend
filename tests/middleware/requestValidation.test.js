const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateTripRequest,
  validateAddPaymentMethod,
  validateAirportQueueEnter,
  validateTripTipUpdate,
  validateTripFeedbackUpdate,
  validateDriverTripPreferences,
  validateDriverDocumentUpload,
} = require('../../middleware/requestValidation');

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('validateTripRequest normalizes valid payload', async () => {
  const req = {
    body: {
      riderId: '507f1f77bcf86cd799439011',
      pickup: {
        latitude: '41.9742',
        longitude: '-87.9073',
        address: ' ORD Terminal ',
        city: ' Chicago ',
        country: 'us',
      },
      dropoff: {
        latitude: 41.8781,
        longitude: -87.6298,
        city: 'Milwaukee',
        country: 'US',
      },
      surgeRadiusKm: '6',
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  validateTripRequest(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.body.riderId, '507f1f77bcf86cd799439011');
  assert.equal(req.body.pickup.address, 'ORD Terminal');
  assert.equal(req.body.pickup.city, 'Chicago');
  assert.equal(req.body.pickup.country, 'US');
  assert.equal(req.body.dropoff.city, 'Milwaukee');
  assert.equal(req.body.dropoff.country, 'US');
  assert.equal(req.body.pickup.latitude, 41.9742);
  assert.equal(req.body.surgeRadiusKm, 6);
  assert.equal(req.body.serviceDogRequested, false);
  assert.equal(req.body.teenPickup, false);
  assert.equal(req.body.teenSeatingPolicy, 'none');
});

test('validateTripRequest enforces teen back seat policy', async () => {
  const req = {
    body: {
      riderId: '507f1f77bcf86cd799439011',
      pickup: {
        latitude: 41.9742,
        longitude: -87.9073,
      },
      dropoff: {
        latitude: 41.8781,
        longitude: -87.6298,
      },
      teenPickup: true,
      teenSeatingPolicy: 'none',
      serviceDogRequested: true,
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  validateTripRequest(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.body.teenPickup, true);
  assert.equal(req.body.teenSeatingPolicy, 'back_seat_only');
  assert.equal(req.body.serviceDogRequested, true);
});

test('validateDriverTripPreferences requires boolean toggles', async () => {
  const req = {
    body: {
      serviceDogEnabled: 'yes',
      teenPickupEnabled: false,
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  validateDriverTripPreferences(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.body.serviceDogEnabled, true);
  assert.equal(req.body.teenPickupEnabled, false);
});

test('validateAddPaymentMethod rejects invalid card payload', async () => {
  const req = {
    body: {
      cardNumber: '1234',
      expMonth: 20,
      expYear: 1999,
      cvc: '1',
      isDefault: true,
    },
  };

  const res = createMockResponse();

  validateAddPaymentMethod(req, res, () => {
    throw new Error('next should not be called for invalid payload');
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, 'Validation failed.');
  assert.ok(Array.isArray(res.payload.errors));
  assert.ok(res.payload.errors.length >= 3);
});

test('validateAirportQueueEnter rejects airport code without coordinates', async () => {
  const req = {
    body: {
      driverId: '507f1f77bcf86cd799439012',
      airportCode: 'ord',
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  validateAirportQueueEnter(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, 'Validation failed.');
  assert.ok(Array.isArray(res.payload.errors));
  assert.ok(res.payload.errors.some(error => error.field === 'latitude'));
});

test('validateTripTipUpdate normalizes valid payload', async () => {
  const req = {
    body: {
      riderId: '507f1f77bcf86cd799439011',
      tipAmount: '12.456',
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  validateTripTipUpdate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.body.riderId, '507f1f77bcf86cd799439011');
  assert.equal(req.body.tipAmount, 12.46);
});

test('validateTripTipUpdate rejects negative tip', async () => {
  const req = {
    body: {
      riderId: '507f1f77bcf86cd799439011',
      tipAmount: -5,
    },
  };

  const res = createMockResponse();

  validateTripTipUpdate(req, res, () => {
    throw new Error('next should not be called for invalid tip payload');
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, 'Validation failed.');
  assert.ok(res.payload.errors.some(error => error.field === 'tipAmount'));
});

test('validateTripFeedbackUpdate normalizes valid payload', async () => {
  const req = {
    body: {
      riderId: '507f1f77bcf86cd799439011',
      overallRating: '5',
      driverProfessionalismRating: 4,
      carCleanlinessRating: '4',
      amenitiesRating: '5',
      greetingRating: 5,
      comments: 'Great ride and very clean car.',
      tipAmount: '18.756',
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  validateTripFeedbackUpdate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.body.riderId, '507f1f77bcf86cd799439011');
  assert.equal(req.body.overallRating, 5);
  assert.equal(req.body.driverProfessionalismRating, 4);
  assert.equal(req.body.carCleanlinessRating, 4);
  assert.equal(req.body.amenitiesRating, 5);
  assert.equal(req.body.greetingRating, 5);
  assert.equal(req.body.comments, 'Great ride and very clean car.');
  assert.equal(req.body.tipAmount, 18.76);
});

test('validateTripFeedbackUpdate rejects empty payload', async () => {
  const req = {
    body: {
      riderId: '507f1f77bcf86cd799439011',
    },
  };

  const res = createMockResponse();

  validateTripFeedbackUpdate(req, res, () => {
    throw new Error('next should not be called for empty feedback payload');
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, 'Validation failed.');
  assert.ok(res.payload.errors.some(error => error.field === 'feedback'));
});

test('validateDriverDocumentUpload accepts premium compliance document types', async () => {
  const req = {
    body: {
      docType: 'hard_card',
      expiresAt: '2027-01-01T00:00:00.000Z',
    },
  };

  const res = createMockResponse();
  let nextCalled = false;

  validateDriverDocumentUpload(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.body.docType, 'hard_card');
  assert.equal(req.body.expiresAt, '2027-01-01T00:00:00.000Z');
});
