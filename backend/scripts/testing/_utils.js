const { performance } = require('node:perf_hooks');

function parseArgs(rawArgs = process.argv.slice(2)) {
  const parsed = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const token = rawArgs[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const nextToken = rawArgs[index + 1];

    if (!nextToken || nextToken.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextToken;
    index += 1;
  }

  return parsed;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function percentile(samples, percentileValue) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const boundedPercentile = Math.min(Math.max(percentileValue, 0), 100);
  const rank = Math.ceil((boundedPercentile / 100) * sorted.length) - 1;
  const index = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[index];
}

function summarizeLatencies(latencies) {
  if (!Array.isArray(latencies) || latencies.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sum = latencies.reduce((total, latency) => total + latency, 0);
  return {
    count: latencies.length,
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    avg: sum / latencies.length,
    p50: percentile(latencies, 50),
    p90: percentile(latencies, 90),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
  };
}

function formatMilliseconds(value) {
  return `${value.toFixed(2)} ms`;
}

function buildUrl(baseUrl, path) {
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${String(path || '')}`;
  return `${normalizedBase}${normalizedPath}`;
}

function normalizeHeaders(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }
  return normalized;
}

async function requestJson(url, options = {}) {
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: normalizeHeaders(options.headers || {}),
      body: options.body,
    });

    let body = null;
    const responseText = await response.text();
    if (responseText) {
      try {
        body = JSON.parse(responseText);
      } catch {
        body = responseText;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      latencyMs: performance.now() - startedAt,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: performance.now() - startedAt,
      body: null,
      error,
    };
  }
}

function randomBetween(minValue, maxValue) {
  return Math.random() * (maxValue - minValue) + minValue;
}

function randomOffsetPoint(point, offsetDelta = 0.01) {
  return {
    latitude: point.latitude + randomBetween(-offsetDelta, offsetDelta),
    longitude: point.longitude + randomBetween(-offsetDelta, offsetDelta),
  };
}

function formatSummaryTable(entries) {
  const longestKey = Math.max(...entries.map(([key]) => key.length), 0);
  return entries
    .map(([key, value]) => `${key.padEnd(longestKey, ' ')} : ${value}`)
    .join('\n');
}

module.exports = {
  parseArgs,
  toNumber,
  toInteger,
  asBoolean,
  percentile,
  summarizeLatencies,
  formatMilliseconds,
  buildUrl,
  requestJson,
  randomOffsetPoint,
  formatSummaryTable,
};
