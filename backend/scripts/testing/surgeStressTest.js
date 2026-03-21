const {
  parseArgs,
  toNumber,
  toInteger,
  summarizeLatencies,
  formatMilliseconds,
  buildUrl,
  requestJson,
  randomOffsetPoint,
  formatSummaryTable,
} = require('./_utils');

const CHICAGO_POINTS = [
  { latitude: 41.9742, longitude: -87.9073, label: 'ORD Terminal' },
  { latitude: 41.7868, longitude: -87.7522, label: 'MDW Terminal' },
  { latitude: 41.8781, longitude: -87.6298, label: 'Chicago Loop' },
  { latitude: 41.8916, longitude: -87.6079, label: 'Streeterville' },
  { latitude: 41.9128, longitude: -87.65, label: 'Lincoln Park' },
];

function pickRandomPoint() {
  return CHICAGO_POINTS[Math.floor(Math.random() * CHICAGO_POINTS.length)];
}

function createPricingPayload(surgeRadiusKm) {
  const pickupBase = pickRandomPoint();
  const dropoffBase = pickRandomPoint();

  const pickup = randomOffsetPoint(pickupBase, 0.02);
  const dropoff = randomOffsetPoint(dropoffBase, 0.02);

  return {
    pickup: {
      ...pickup,
      address: `${pickupBase.label} pickup`,
    },
    dropoff: {
      ...dropoff,
      address: `${dropoffBase.label} dropoff`,
    },
    surgeRadiusKm,
  };
}

async function runSurgeStressTest() {
  const args = parseArgs();

  const apiBaseUrl = args.baseUrl || process.env.API_BASE_URL || 'http://localhost:4000';
  const endpoint = args.path || '/api/trips/upfront-pricing';
  const url = buildUrl(apiBaseUrl, endpoint);

  const totalRequests = Math.max(toInteger(args.requests, 250), 1);
  const concurrency = Math.max(toInteger(args.concurrency, 25), 1);
  const surgeRadiusKm = Math.max(toNumber(args.surgeRadiusKm, 5), 0.5);

  const latencies = [];
  const surgeMultipliers = [];
  const demandRatios = [];
  let successCount = 0;
  let failureCount = 0;
  let requestCursor = 0;

  async function worker() {
    while (true) {
      const current = requestCursor;
      requestCursor += 1;

      if (current >= totalRequests) {
        return;
      }

      const payload = createPricingPayload(surgeRadiusKm);
      const result = await requestJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      latencies.push(result.latencyMs);

      if (result.ok) {
        successCount += 1;
        const surgeMultiplier = Number(result.body?.surgeMultiplier);
        const demandRatio = Number(result.body?.demandRatio);

        if (Number.isFinite(surgeMultiplier)) {
          surgeMultipliers.push(surgeMultiplier);
        }

        if (Number.isFinite(demandRatio)) {
          demandRatios.push(demandRatio);
        }
      } else {
        failureCount += 1;
      }
    }
  }

  console.log(`Running surge stress test against ${url}`);
  console.log(`Requests: ${totalRequests}, Concurrency: ${concurrency}, Surge radius: ${surgeRadiusKm}km`);

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 1);

  const successRate = successCount / totalRequests;
  const latencySummary = summarizeLatencies(latencies);
  const surgeSummary = summarizeLatencies(surgeMultipliers);
  const demandSummary = summarizeLatencies(demandRatios);

  console.log('');
  console.log(
    formatSummaryTable([
      ['Successful responses', successCount],
      ['Failed responses', failureCount],
      ['Success rate', `${(successRate * 100).toFixed(2)}%`],
      ['Req/sec', (totalRequests / elapsedSeconds).toFixed(2)],
      ['Latency avg', formatMilliseconds(latencySummary.avg)],
      ['Latency p95', formatMilliseconds(latencySummary.p95)],
      ['Surge avg', surgeSummary.avg.toFixed(3)],
      ['Surge p95', surgeSummary.p95.toFixed(3)],
      ['Surge max', surgeSummary.max.toFixed(3)],
      ['Demand ratio avg', demandSummary.avg.toFixed(3)],
      ['Demand ratio p95', demandSummary.p95.toFixed(3)],
    ])
  );

  if (successRate < 0.95) {
    console.error('\nSurge stress test failed: success rate fell below 95%.');
    process.exitCode = 1;
  }
}

runSurgeStressTest().catch(error => {
  console.error('Surge stress test failed with an unexpected error:', error);
  process.exitCode = 1;
});
