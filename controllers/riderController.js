const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Rider = require('../models/Rider');
const PaymentLog = require('../models/PaymentLog');
const {
  createCustomer,
  createConnectAccount,
  addPaymentMethod,
  isStripeConfigured,
} = require('../services/stripeService');

function signToken(riderId) {
  return jwt.sign({ sub: riderId, role: 'rider' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function toTrimmedString(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFavoriteLocationPayload(payload) {
  const label = toTrimmedString(payload?.label);
  const address = toTrimmedString(payload?.address);
  const latitude = toFiniteNumber(payload?.latitude);
  const longitude = toFiniteNumber(payload?.longitude);
  const requestedPlaceType = toTrimmedString(payload?.placeType).toLowerCase();

  if (!label || label.length < 2 || label.length > 60) {
    throw new Error('label must be between 2 and 60 characters.');
  }

  if (!address || address.length < 4 || address.length > 220) {
    throw new Error('address must be between 4 and 220 characters.');
  }

  if (latitude === null || latitude < -90 || latitude > 90) {
    throw new Error('latitude must be a number between -90 and 90.');
  }

  if (longitude === null || longitude < -180 || longitude > 180) {
    throw new Error('longitude must be a number between -180 and 180.');
  }

  const placeType = ['home', 'work', 'other'].includes(requestedPlaceType)
    ? requestedPlaceType
    : 'other';

  return {
    label,
    address,
    latitude,
    longitude,
    placeType,
  };
}

async function registerRider(req, res) {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ message: 'name, phone, email and password are required.' });
    }

    const existing = await Rider.findOne({
      $or: [{ phone }, { email: email.toLowerCase() }],
    });

    if (existing) {
      return res.status(409).json({ message: 'Rider with phone or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const customer = await createCustomer({ email, name, phone });
    const connectAccount = await createConnectAccount({ email });

    const rider = await Rider.create({
      name,
      phone,
      email,
      passwordHash,
      status: 'active',
      stripeCustomerId: customer.id,
      stripeConnectAccountId: connectAccount.id,
    });

    await PaymentLog.create({
      rider: rider._id,
      event: 'rider_registered',
      status: 'success',
      customerId: rider.stripeCustomerId,
      connectAccountId: rider.stripeConnectAccountId,
      metadata: {
        stripeConfigured: isStripeConfigured(),
      },
    });

    const token = signToken(rider._id.toString());

    return res.status(201).json({
      message: 'Rider registered successfully.',
      token,
      rider: {
        id: rider._id,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        status: rider.status,
        stripeCustomerId: rider.stripeCustomerId,
        stripeConnectAccountId: rider.stripeConnectAccountId,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to register rider.' });
  }
}

async function addRiderPaymentMethod(req, res) {
  try {
    const { riderId } = req.params;
    const {
      paymentMethodId,
      cardNumber,
      expMonth,
      expYear,
      cvc,
      isDefault = true,
    } = req.body;

    if (!paymentMethodId && !(cardNumber && expMonth && expYear && cvc)) {
      return res.status(400).json({
        message: 'Provide paymentMethodId or full test card details (cardNumber, expMonth, expYear, cvc).',
      });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found.' });
    }

    const method = await addPaymentMethod({
      customerId: rider.stripeCustomerId,
      paymentMethodId,
      card: paymentMethodId
        ? null
        : {
            number: cardNumber,
            expMonth,
            expYear,
            cvc,
          },
    });

    if (isDefault) {
      rider.paymentMethods.forEach(existing => {
        existing.isDefault = false;
      });
    }

    const paymentMethodEntry = {
      provider: method.provider,
      paymentMethodId: method.id,
      brand: method.brand,
      last4: method.last4,
      expMonth: method.expMonth,
      expYear: method.expYear,
      isDefault: isDefault || rider.paymentMethods.length === 0,
      status: 'active',
      addedAt: new Date(),
    };

    rider.paymentMethods.push(paymentMethodEntry);
    await rider.save();

    await PaymentLog.create({
      rider: rider._id,
      event: 'payment_method_added',
      status: 'success',
      paymentMethodId: method.id,
      customerId: rider.stripeCustomerId,
      metadata: {
        brand: method.brand,
        last4: method.last4,
        provider: method.provider,
      },
    });

    return res.status(201).json({
      message: 'Payment method added successfully.',
      paymentMethod: paymentMethodEntry,
    });
  } catch (error) {
    const { riderId } = req.params;

    const rider = await Rider.findById(riderId).catch(() => null);
    await PaymentLog.create({
      rider: rider?._id || null,
      event: 'payment_method_add_failed',
      status: 'failed',
      customerId: rider?.stripeCustomerId || null,
      errorMessage: error.message || 'Unknown payment method error.',
      metadata: {
        stripeConfigured: isStripeConfigured(),
      },
    }).catch(() => null);

    return res.status(500).json({ message: error.message || 'Failed to add payment method.' });
  }
}

async function listRiderPaymentMethods(req, res) {
  try {
    const { riderId } = req.params;

    const rider = await Rider.findById(riderId).select('paymentMethods');
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found.' });
    }

    return res.status(200).json(rider.paymentMethods);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch payment methods.' });
  }
}

async function getRiderHome(req, res) {
  try {
    const { riderId } = req.params;

    const rider = await Rider.findById(riderId).select('name status paymentMethods');
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found.' });
    }

    const defaultMethod = rider.paymentMethods.find(method => method.isDefault);

    return res.status(200).json({
      greeting: `Welcome back, ${rider.name}`,
      status: rider.status,
      totalPaymentMethods: rider.paymentMethods.length,
      defaultPaymentMethod: defaultMethod || null,
      quickActions: ['Book Ride', 'Favorites', 'Trip History', 'Support'],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load rider home data.' });
  }
}

async function listRiderFavoriteLocations(req, res) {
  try {
    const { riderId } = req.params;

    const rider = await Rider.findById(riderId).select('favoriteLocations');
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found.' });
    }

    const favorites = [...(rider.favoriteLocations || [])].sort(
      (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    );

    return res.status(200).json({
      total: favorites.length,
      favorites,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch favorite locations.' });
  }
}

async function addRiderFavoriteLocation(req, res) {
  try {
    const { riderId } = req.params;
    const rider = await Rider.findById(riderId).select('favoriteLocations');

    if (!rider) {
      return res.status(404).json({ message: 'Rider not found.' });
    }

    const normalizedFavorite = normalizeFavoriteLocationPayload(req.body);

    const duplicate = rider.favoriteLocations.find(location => {
      const sameLabel =
        String(location.label || '').toLowerCase() === normalizedFavorite.label.toLowerCase();

      const sameCoordinates =
        Math.abs(Number(location.latitude) - normalizedFavorite.latitude) < 0.0001 &&
        Math.abs(Number(location.longitude) - normalizedFavorite.longitude) < 0.0001;

      return sameLabel || sameCoordinates;
    });

    if (duplicate) {
      return res.status(409).json({
        message: 'A similar favorite location already exists.',
        favorite: duplicate,
      });
    }

    if (normalizedFavorite.placeType !== 'other') {
      rider.favoriteLocations = rider.favoriteLocations.filter(
        location => location.placeType !== normalizedFavorite.placeType
      );
    }

    if ((rider.favoriteLocations?.length || 0) >= 15) {
      return res.status(400).json({
        message: 'You can store up to 15 favorite locations.',
      });
    }

    rider.favoriteLocations.push(normalizedFavorite);
    await rider.save();

    const createdFavorite = rider.favoriteLocations[rider.favoriteLocations.length - 1];

    return res.status(201).json({
      message: 'Favorite location saved.',
      favorite: createdFavorite,
      total: rider.favoriteLocations.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('must be')) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: error.message || 'Failed to save favorite location.' });
  }
}

async function removeRiderFavoriteLocation(req, res) {
  try {
    const { riderId, favoriteId } = req.params;
    const rider = await Rider.findById(riderId).select('favoriteLocations');

    if (!rider) {
      return res.status(404).json({ message: 'Rider not found.' });
    }

    const favoriteIndex = rider.favoriteLocations.findIndex(
      location => String(location._id) === String(favoriteId)
    );

    if (favoriteIndex === -1) {
      return res.status(404).json({ message: 'Favorite location not found.' });
    }

    const deletedFavorite = rider.favoriteLocations[favoriteIndex];
    rider.favoriteLocations.splice(favoriteIndex, 1);
    await rider.save();

    return res.status(200).json({
      message: 'Favorite location removed.',
      favorite: deletedFavorite,
      total: rider.favoriteLocations.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to remove favorite location.' });
  }
}

async function loginRider(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'email and password are required.' });
      }

      const rider = await Rider.findOne({ email: email.toLowerCase() }).select(
        'passwordHash name phone email status'
      );

      if (!rider) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const valid = await bcrypt.compare(password, rider.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const token = signToken(rider._id.toString());

      return res.status(200).json({
        message: 'Login successful.',
        token,
        rider: {
          id: rider._id,
          name: rider.name,
          phone: rider.phone,
          email: rider.email,
          status: rider.status,
        },
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || 'Login failed.' });
    }
}

module.exports = {
  registerRider,
  loginRider,
  addRiderPaymentMethod,
  listRiderPaymentMethods,
  getRiderHome,
  listRiderFavoriteLocations,
  addRiderFavoriteLocation,
  removeRiderFavoriteLocation,
};
