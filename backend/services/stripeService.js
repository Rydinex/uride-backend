const { randomUUID } = require('crypto');
const Stripe = require('stripe');

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripeClient() {
  if (!isStripeConfigured()) {
    return null;
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function createCustomer({ email, name, phone }) {
  const stripe = getStripeClient();
  if (!stripe) {
    return {
      id: `mock_cus_${randomUUID()}`,
      provider: 'mock',
    };
  }

  const customer = await stripe.customers.create({
    email,
    name,
    phone,
  });

  return {
    id: customer.id,
    provider: 'stripe',
  };
}

async function createConnectAccount({ email }) {
  const stripe = getStripeClient();
  if (!stripe) {
    return {
      id: `mock_acct_${randomUUID()}`,
      provider: 'mock',
    };
  }

  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  return {
    id: account.id,
    provider: 'stripe',
  };
}

async function addPaymentMethod({ customerId, paymentMethodId, card }) {
  const stripe = getStripeClient();

  if (!stripe || !customerId || customerId.startsWith('mock_cus_')) {
    return {
      id: paymentMethodId || `mock_pm_${randomUUID()}`,
      brand: 'visa',
      last4: (card?.number || '4242424242424242').slice(-4),
      expMonth: Number(card?.expMonth || 12),
      expYear: Number(card?.expYear || 2030),
      provider: 'mock',
    };
  }

  let methodId = paymentMethodId;

  if (!methodId) {
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: card.number,
        exp_month: Number(card.expMonth),
        exp_year: Number(card.expYear),
        cvc: card.cvc,
      },
    });
    methodId = paymentMethod.id;
  }

  await stripe.paymentMethods.attach(methodId, {
    customer: customerId,
  });

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: methodId,
    },
  });

  const attachedPaymentMethod = await stripe.paymentMethods.retrieve(methodId);

  return {
    id: attachedPaymentMethod.id,
    brand: attachedPaymentMethod.card?.brand || 'unknown',
    last4: attachedPaymentMethod.card?.last4 || '',
    expMonth: attachedPaymentMethod.card?.exp_month || null,
    expYear: attachedPaymentMethod.card?.exp_year || null,
    provider: 'stripe',
  };
}

module.exports = {
  isStripeConfigured,
  createCustomer,
  createConnectAccount,
  addPaymentMethod,
};
