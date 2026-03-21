const express = require('express');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  validateIdParam,
  validateTripUpfrontPricing,
  validateTripRequest,
  validateTripDriverResponse,
  validateTripActionPayload,
  validateTripTrackPayload,
  validateTripStatusUpdate,
  validateTripTrackingQuery,
  validateTripTipUpdate,
  validateTripFeedbackUpdate,
  validateTripDriverFeedbackUpdate,
  validateTripActivation,
} = require('../middleware/requestValidation');
const {
  getUpfrontPricingQuote,
  requestTrip,
  getIncomingTripsForDriver,
  respondToTripRequest,
  startTrip,
  trackTripRoute,
  endTrip,
  updateTripStatus,
  getTripTracking,
  getTripSummary,
  generateTripReceipt,
  getTripReceipt,
  updateTripTip,
  updateTripFeedback,
  updateTripDriverFeedback,
  getPendingTripFeedbackForRider,
  getTripById,
  getActiveTripForRider,
  getCurrentTripForDriver,
  activateScheduledTrip,
} = require('../controllers/tripController');

const router = express.Router();

const tripPricingRateLimiter = createRateLimiter({
  identifier: 'trips:pricing',
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_TRIP_PRICING_MAX || 120),
  message: 'Too many pricing requests. Please wait and try again.',
});

const tripWriteRateLimiter = createRateLimiter({
  identifier: 'trips:write',
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_TRIP_WRITE_MAX || 90),
  message: 'Too many trip updates. Please slow down.',
});

router.post('/upfront-pricing', tripPricingRateLimiter, validateTripUpfrontPricing, getUpfrontPricingQuote);
router.post('/request', tripWriteRateLimiter, validateTripRequest, requestTrip);
router.get('/driver/:driverId/incoming', validateIdParam('driverId'), getIncomingTripsForDriver);
router.get('/driver/:driverId/current', validateIdParam('driverId'), getCurrentTripForDriver);
router.get('/rider/:riderId/active', validateIdParam('riderId'), getActiveTripForRider);
router.get('/rider/:riderId/feedback-pending', validateIdParam('riderId'), getPendingTripFeedbackForRider);
router.post('/:tripId/driver-response', validateIdParam('tripId'), tripWriteRateLimiter, validateTripDriverResponse, respondToTripRequest);
router.post('/:tripId/start', validateIdParam('tripId'), tripWriteRateLimiter, validateTripActionPayload, startTrip);
router.post('/:tripId/track', validateIdParam('tripId'), tripWriteRateLimiter, validateTripTrackPayload, trackTripRoute);
router.post('/:tripId/end', validateIdParam('tripId'), tripWriteRateLimiter, validateTripActionPayload, endTrip);
router.patch('/:tripId/status', validateIdParam('tripId'), tripWriteRateLimiter, validateTripStatusUpdate, updateTripStatus);
router.post('/:tripId/activate', validateIdParam('tripId'), tripWriteRateLimiter, validateTripActivation, activateScheduledTrip);
router.get('/:tripId/tracking', validateIdParam('tripId'), validateTripTrackingQuery, getTripTracking);
router.get('/:tripId/summary', validateIdParam('tripId'), getTripSummary);
router.post('/:tripId/receipt/generate', validateIdParam('tripId'), generateTripReceipt);
router.get('/:tripId/receipt', validateIdParam('tripId'), getTripReceipt);
router.patch('/:tripId/tip', validateIdParam('tripId'), tripWriteRateLimiter, validateTripTipUpdate, updateTripTip);
router.patch('/:tripId/feedback', validateIdParam('tripId'), tripWriteRateLimiter, validateTripFeedbackUpdate, updateTripFeedback);
router.patch(
  '/:tripId/driver-feedback',
  validateIdParam('tripId'),
  tripWriteRateLimiter,
  validateTripDriverFeedbackUpdate,
  updateTripDriverFeedback
);
router.get('/:tripId', validateIdParam('tripId'), getTripById);

module.exports = router;
