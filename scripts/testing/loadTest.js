const {
  parseArgs,
  toNumber,
  toInteger,
  summarizeLatencies,
  formatMilliseconds,
  buildUrl,
  requestJson,
  formatSummaryTable,
} = require('./_utils');

async function runLoadTest() {
  const args = parseArgs();

  const apiBaseUrl = args.baseUrl || process.env.API_BASE_URL || 'http://localhost:4000';
  const path = args.path || '/api/health';
  const method = String(args.method || 'GET').toUpperCase();
  const durationSeconds = Math.max(toInteger(args.durationSec, 30), 1);
  const concurrency = Math.max(toInteger(args.concurrency, 20), 1);
  const minSuccessRate = Math.min(Math.max(toNumber(args.minSuccessRate, 0.95), 0), 1);

  const requestBody = args.body
    ? args.body
    : method === 'POST' && path === '/api/trips/upfront-pricing'
    ? JSON.stringify({
        pickup: { latitude: 41.9742, longitude: -87.9073, address: 'ORD Terminal 1' },
        dropoff: { latitude: 41.8781, longitude: -87.6298, address: 'Chicago Loop' },
      })
    : null;

  const url = buildUrl(apiBaseUrl, path);
  const headers = requestBody ? { 'Content-Type': 'application/json' } : undefined;

  const startedAt = Date.now();
  const stopAt = startedAt + durationSeconds * 1000;

  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  const latencies = [];
  const statusCounts = new Map();

  async function worker() {
    while (Date.now() < stopAt) {
      const result = await requestJson(url, {
        method,
        headers,
        body: requestBody,
      });

      totalRequests += 1;
      latencies.push(result.latencyMs);

      const currentCount = statusCounts.get(result.status) || 0;
      statusCounts.set(result.status, currentCount + 1);

      if (result.ok) {
        successfulRequests += 1;
      } else {
        failedRequests += 1;
      }
    }
  }

  console.log(`Running load test: ${method} ${url}`);
  console.log(`Duration: ${durationSeconds}s, Concurrency: ${concurrency}`);

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 1);
  const successRate = totalRequests === 0 ? 0 : successfulRequests / totalRequests;
  const requestsPerSecond = totalRequests / elapsedSeconds;
  const latencySummary = summarizeLatencies(latencies);

  const statusBreakdown = Array.from(statusCounts.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');

  console.log('');
  console.log(
    formatSummaryTable([
      ['Total requests', totalRequests],
      ['Successful', successfulRequests],
      ['Failed', failedRequests],
      ['Success rate', `${(successRate * 100).toFixed(2)}%`],
      ['Req/sec', requestsPerSecond.toFixed(2)],
      ['Latency avg', formatMilliseconds(latencySummary.avg)],
      ['Latency p95', formatMilliseconds(latencySummary.p95)],
      ['Latency p99', formatMilliseconds(latencySummary.p99)],
      ['Status counts', statusBreakdown || 'none'],
    ])
  );

  if (successRate < minSuccessRate) {
    console.error(`\nLoad test failed: success rate ${(successRate * 100).toFixed(2)}% is below ${(minSuccessRate * 100).toFixed(2)}%`);
    process.exitCode = 1;
  }
}

runLoadTest().catch(error => {
  console.error('Load test failed with an unexpected error:', error);
  process.exitCode = 1;
});
