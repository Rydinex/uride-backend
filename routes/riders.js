const express = require('express');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  validateIdParam,
  validateRiderRegistration,
  validateAddPaymentMethod,
} = require('../middleware/requestValidation');
const {
  registerRider,
  loginRider,
  addRiderPaymentMethod,
  listRiderPaymentMethods,
  getRiderHome,
  listRiderFavoriteLocations,
  addRiderFavoriteLocation,
  removeRiderFavoriteLocation,
} = require('../controllers/riderController');

const router = express.Router();

const riderRegistrationRateLimiter = createRateLimiter({
  identifier: 'riders:register',
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RIDER_REGISTER_MAX || 10),
  message: 'Too many rider registration attempts. Please wait before retrying.',
});

const paymentMethodRateLimiter = createRateLimiter({
  identifier: 'riders:payment-methods',
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RIDER_PAYMENT_METHOD_MAX || 20),
  message: 'Too many payment method requests. Please try again shortly.',
});

const favoriteLocationsRateLimiter = createRateLimiter({
  identifier: 'riders:favorite-locations',
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RIDER_FAVORITES_MAX || 40),
  message: 'Too many favorite location requests. Please wait and retry.',
});

router.post('/register', riderRegistrationRateLimiter, validateRiderRegistration, registerRider);
router.post('/login', loginRider);
router.post(
  '/:riderId/payment-methods',
  validateIdParam('riderId'),
  paymentMethodRateLimiter,
  validateAddPaymentMethod,
  addRiderPaymentMethod
);
router.get('/:riderId/payment-methods', validateIdParam('riderId'), listRiderPaymentMethods);
router.get('/:riderId/home', validateIdParam('riderId'), getRiderHome);
router.get(
  '/:riderId/favorite-locations',
  validateIdParam('riderId'),
  favoriteLocationsRateLimiter,
  listRiderFavoriteLocations
);
router.post(
  '/:riderId/favorite-locations',
  validateIdParam('riderId'),
  favoriteLocationsRateLimiter,
  addRiderFavoriteLocation
);
router.delete(
  '/:riderId/favorite-locations/:favoriteId',
  validateIdParam('riderId'),
  validateIdParam('favoriteId'),
  favoriteLocationsRateLimiter,
  removeRiderFavoriteLocation
);

module.exports = router;
