const {
  parseArgs,
  toInteger,
  summarizeLatencies,
  formatMilliseconds,
  buildUrl,
  requestJson,
  formatSummaryTable,
} = require('./_utils');

function generateUniqueRider(index) {
  const suffix = `${Date.now()}_${index}_${Math.floor(Math.random() * 10000)}`;
  return {
    name: `Payment Test Rider ${index}`,
    phone: `+1555${String(1000000 + index).slice(-7)}`,
    email: `payment.test.${suffix}@rydinex.com`,
    password: 'Passw0rd!123',
  };
}

async function runPaymentTest() {
  const args = parseArgs();

  const apiBaseUrl = args.baseUrl || process.env.API_BASE_URL || 'http://localhost:4000';
  const totalUsers = Math.max(toInteger(args.users, 30), 1);
  const concurrency = Math.max(toInteger(args.concurrency, 10), 1);

  const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
  const allowLiveStripe = String(process.env.PAYMENT_TEST_ALLOW_LIVE || 'false').toLowerCase() === 'true';

  if (stripeSecret && !stripeSecret.startsWith('sk_test_') && !allowLiveStripe) {
    console.error('Refusing to run payment test against a non-test Stripe key. Set PAYMENT_TEST_ALLOW_LIVE=true to override.');
    process.exitCode = 1;
    return;
  }

  const registerUrl = buildUrl(apiBaseUrl, '/api/riders/register');
  const riderBaseUrl = buildUrl(apiBaseUrl, '/api/riders');

  let createdUsers = 0;
  let paymentMethodsAdded = 0;
  let failures = 0;
  let cursor = 0;

  const registerLatencies = [];
  const paymentLatencies = [];

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= totalUsers) {
        return;
      }

      const rider = generateUniqueRider(index + 1);

      const registerResult = await requestJson(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rider),
      });

      registerLatencies.push(registerResult.latencyMs);

      if (!registerResult.ok) {
        failures += 1;
        continue;
      }

      createdUsers += 1;
      const riderId = registerResult.body?.rider?.id;

      if (!riderId) {
        failures += 1;
        continue;
      }

      const paymentMethodResult = await requestJson(`${riderBaseUrl}/${riderId}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: '4242424242424242',
          expMonth: 12,
          expYear: new Date().getUTCFullYear() + 2,
          cvc: '123',
          isDefault: true,
        }),
      });

      paymentLatencies.push(paymentMethodResult.latencyMs);

      if (!paymentMethodResult.ok) {
        failures += 1;
        continue;
      }

      paymentMethodsAdded += 1;
    }
  }

  console.log(`Running payment test with users=${totalUsers}, concurrency=${concurrency}`);

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 1);

  const registerSummary = summarizeLatencies(registerLatencies);
  const paymentSummary = summarizeLatencies(paymentLatencies);

  console.log('');
  console.log(
    formatSummaryTable([
      ['Users targeted', totalUsers],
      ['Users created', createdUsers],
      ['Payment methods added', paymentMethodsAdded],
      ['Failures', failures],
      ['Req/sec', ((registerLatencies.length + paymentLatencies.length) / elapsedSeconds).toFixed(2)],
      ['Register avg latency', formatMilliseconds(registerSummary.avg)],
      ['Register p95 latency', formatMilliseconds(registerSummary.p95)],
      ['Payment avg latency', formatMilliseconds(paymentSummary.avg)],
      ['Payment p95 latency', formatMilliseconds(paymentSummary.p95)],
    ])
  );

  if (failures > 0) {
    process.exitCode = 1;
  }
}

runPaymentTest().catch(error => {
  console.error('Payment test failed with an unexpected error:', error);
  process.exitCode = 1;
});
