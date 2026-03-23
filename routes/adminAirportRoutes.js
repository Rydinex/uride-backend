const express = require('express');
const { requireAdminAuth } = require('../middleware/adminAuth');
const {
  getAirportSummary,
  getQueue,
  getStagingDrivers,
  getViolations,
} = require('../controllers/adminAirportController');

const router = express.Router();

router.use(requireAdminAuth);

router.get('/summary', getAirportSummary);
router.get('/violations', getViolations);
router.get('/:airportCode/queue/:queueGroup', getQueue);
router.get('/:airportCode/staging/:queueGroup', getStagingDrivers);

module.exports = router;
