const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter } = require('../../middleware/rateLimit');

function createMockRequest(ip = '127.0.0.1') {
  return {
    ip,
    headers: {},
    socket: { remoteAddress: ip },
  };
}

function createMockResponse() {
  const headers = {};

  return {
    statusCode: 200,
    payload: null,
    setHeader(key, value) {
      headers[key] = value;
    },
    getHeader(key) {
      return headers[key];
    },
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

test('rate limiter allows requests up to max and blocks after limit', async () => {
  let nowMs = 1_000;

  const limiter = createRateLimiter({
    identifier: 'test:limit',
    max: 2,
    windowMs: 1_000,
    now: () => nowMs,
    store: new Map(),
  });

  const req = createMockRequest('10.0.0.1');

  for (let index = 0; index < 2; index += 1) {
    const res = createMockResponse();
    let nextCalled = false;

    limiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  }

  const blockedRes = createMockResponse();
  let blockedNextCalled = false;

  limiter(req, blockedRes, () => {
    blockedNextCalled = true;
  });

  assert.equal(blockedNextCalled, false);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.payload.message, 'Too many requests. Please try again later.');
});

test('rate limiter resets after window', async () => {
  let nowMs = 5_000;

  const limiter = createRateLimiter({
    identifier: 'test:window-reset',
    max: 1,
    windowMs: 1_000,
    now: () => nowMs,
    store: new Map(),
  });

  const req = createMockRequest('10.0.0.2');

  const firstRes = createMockResponse();
  limiter(req, firstRes, () => {});

  const blockedRes = createMockResponse();
  limiter(req, blockedRes, () => {});
  assert.equal(blockedRes.statusCode, 429);

  nowMs += 1_500;

  const afterResetRes = createMockResponse();
  let nextCalled = false;

  limiter(req, afterResetRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(afterResetRes.statusCode, 200);
});
