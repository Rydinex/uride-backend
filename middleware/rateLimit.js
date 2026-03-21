const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 120;
const DEFAULT_CLEANUP_INTERVAL = 25;

const sharedStore = new Map();

function resolveClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length) {
    return String(forwardedFor[0]).trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function cleanupExpiredEntries(store, nowMs) {
  for (const [key, value] of store.entries()) {
    if (!value || !Number.isFinite(value.resetAt) || value.resetAt <= nowMs) {
      store.delete(key);
    }
  }
}

function setStandardRateLimitHeaders(res, max, remaining, resetAtMs) {
  const safeRemaining = Math.max(remaining, 0);
  const resetInSeconds = Math.max(Math.ceil((resetAtMs - Date.now()) / 1000), 0);

  res.setHeader('RateLimit-Limit', String(max));
  res.setHeader('RateLimit-Remaining', String(safeRemaining));
  res.setHeader('RateLimit-Reset', String(resetInSeconds));
}

function createRateLimiter(options = {}) {
  const windowMs = Math.max(Number(options.windowMs) || DEFAULT_WINDOW_MS, 1000);
  const max = Math.max(Number(options.max) || DEFAULT_MAX, 1);
  const identifier = String(options.identifier || 'global');
  const message = String(options.message || 'Too many requests. Please try again later.');
  const includeHeaders = options.includeHeaders !== false;
  const cleanupInterval = Math.max(Number(options.cleanupInterval) || DEFAULT_CLEANUP_INTERVAL, 1);
  const now = typeof options.now === 'function' ? options.now : Date.now;

  const keyGenerator =
    typeof options.keyGenerator === 'function'
      ? options.keyGenerator
      : req => resolveClientIp(req);

  const store = options.store instanceof Map ? options.store : sharedStore;

  let requestCountSinceCleanup = 0;

  return function rateLimitMiddleware(req, res, next) {
    const keyPart = keyGenerator(req);
    if (!keyPart) {
      return next();
    }

    const nowMs = now();
    requestCountSinceCleanup += 1;

    if (requestCountSinceCleanup >= cleanupInterval) {
      cleanupExpiredEntries(store, nowMs);
      requestCountSinceCleanup = 0;
    }

    const key = `${identifier}:${String(keyPart)}`;
    const existingEntry = store.get(key);

    if (!existingEntry || existingEntry.resetAt <= nowMs) {
      const resetAt = nowMs + windowMs;
      const nextEntry = {
        count: 1,
        resetAt,
      };

      store.set(key, nextEntry);

      if (includeHeaders) {
        setStandardRateLimitHeaders(res, max, max - 1, resetAt);
      }

      return next();
    }

    existingEntry.count += 1;

    if (includeHeaders) {
      setStandardRateLimitHeaders(res, max, max - existingEntry.count, existingEntry.resetAt);
    }

    if (existingEntry.count > max) {
      const retryAfterSeconds = Math.max(Math.ceil((existingEntry.resetAt - nowMs) / 1000), 1);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        message,
        retryAfterSeconds,
      });
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
  _private: {
    resolveClientIp,
    cleanupExpiredEntries,
  },
};
