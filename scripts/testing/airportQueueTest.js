const {
  parseArgs,
  asBoolean,
  buildUrl,
  requestJson,
  randomOffsetPoint,
  formatSummaryTable,
} = require('./_utils');

const ORD_REFERENCE_POINT = { latitude: 41.9742, longitude: -87.9073 };

function parseDriverIds(rawValue) {
  if (!rawValue) {
    return [];
  }

  return String(rawValue)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

async function runAirportQueueTest() {
  const args = parseArgs();
  const apiBaseUrl = args.baseUrl || process.env.API_BASE_URL || 'http://localhost:4000';

  const driverIds = parseDriverIds(args.driverIds || process.env.AIRPORT_QUEUE_DRIVER_IDS);
  const shouldCleanup = asBoolean(args.cleanup, true);

  if (driverIds.length < 2) {
    console.error('Airport queue test requires at least 2 approved driver IDs via --driverIds or AIRPORT_QUEUE_DRIVER_IDS.');
    process.exitCode = 1;
    return;
  }

  const enterUrl = buildUrl(apiBaseUrl, '/api/airport-queue/enter');
  const statusBaseUrl = buildUrl(apiBaseUrl, '/api/airport-queue/driver');
  const exitUrl = buildUrl(apiBaseUrl, '/api/airport-queue/exit');

  const entered = [];
  const failures = [];

  console.log(`Running airport queue FIFO test for ${driverIds.length} drivers`);

  for (let index = 0; index < driverIds.length; index += 1) {
    const driverId = driverIds[index];
    const offsetPoint = randomOffsetPoint(ORD_REFERENCE_POINT, 0.004);

    const enterResult = await requestJson(enterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId,
        latitude: offsetPoint.latitude,
        longitude: offsetPoint.longitude,
        airportCode: 'ORD',
      }),
    });

    if (!enterResult.ok) {
      failures.push({ stage: 'enter', driverId, status: enterResult.status, details: enterResult.body });
      continue;
    }

    entered.push({
      driverId,
      enterStatus: enterResult.status,
      enterPayload: enterResult.body,
    });
  }

  const statusSnapshots = [];
  for (const entry of entered) {
    const statusResult = await requestJson(`${statusBaseUrl}/${entry.driverId}/status?latitude=41.9742&longitude=-87.9073`, {
      method: 'GET',
    });

    if (!statusResult.ok) {
      failures.push({ stage: 'status', driverId: entry.driverId, status: statusResult.status, details: statusResult.body });
      continue;
    }

    const queuePosition = Number(statusResult.body?.queueEntry?.position);
    statusSnapshots.push({
      driverId: entry.driverId,
      position: Number.isFinite(queuePosition) ? queuePosition : null,
      queueStatus: statusResult.body?.queueEntry?.status || null,
    });
  }

  const observedPositions = statusSnapshots.map(snapshot => snapshot.position).filter(position => Number.isFinite(position));
  const isMonotonic = observedPositions.every((position, index) => index === 0 || position > observedPositions[index - 1]);

  if (!isMonotonic) {
    failures.push({
      stage: 'fifo-check',
      driverId: 'all',
      status: 0,
      details: 'Observed queue positions are not strictly increasing in join order.',
    });
  }

  if (shouldCleanup) {
    for (const entry of entered) {
      await requestJson(exitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: entry.driverId,
          reason: 'airport queue test cleanup',
        }),
      });
    }
  }

  console.log('');
  console.log(
    formatSummaryTable([
      ['Drivers attempted', driverIds.length],
      ['Drivers entered', entered.length],
      ['Status snapshots', statusSnapshots.length],
      ['FIFO monotonic', isMonotonic ? 'yes' : 'no'],
      ['Failures', failures.length],
    ])
  );

  if (failures.length) {
    console.log('\nFailure details:');
    failures.forEach((failure, index) => {
      console.log(`${index + 1}. stage=${failure.stage} driverId=${failure.driverId} status=${failure.status}`);
      if (failure.details) {
        console.log(`   details=${JSON.stringify(failure.details)}`);
      }
    });

    process.exitCode = 1;
  }
}

runAirportQueueTest().catch(error => {
  console.error('Airport queue test failed with an unexpected error:', error);
  process.exitCode = 1;
});
