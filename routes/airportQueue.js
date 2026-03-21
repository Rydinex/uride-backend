const express = require('express');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  validateAirportPickupInstructionsQuery,
  validateAirportQueueStatusQuery,
  validateAirportQueueEnter,
  validateAirportQueueExit,
} = require('../middleware/requestValidation');
const {
  getGeofences,
  enterQueue,
  exitQueue,
  getDriverQueueStatus,
  getAirportPickupInstructions,
} = require('../controllers/airportQueueController');

const router = express.Router();

const airportQueueWriteRateLimiter = createRateLimiter({
  identifier: 'airport-queue:write',
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AIRPORT_QUEUE_WRITE_MAX || 40),
  message: 'Too many airport queue actions. Please retry shortly.',
});

router.get('/geofences', getGeofences);
router.get('/pickup-instructions', validateAirportPickupInstructionsQuery, getAirportPickupInstructions);
router.get('/driver/:driverId/status', validateAirportQueueStatusQuery, getDriverQueueStatus);
router.post('/enter', airportQueueWriteRateLimiter, validateAirportQueueEnter, enterQueue);
router.post('/exit', airportQueueWriteRateLimiter, validateAirportQueueExit, exitQueue);

module.exports = router;
