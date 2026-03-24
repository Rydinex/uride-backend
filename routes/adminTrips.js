const express = require('express');
const {
  listTrips,
  getTripMonitoringMap,
  getComplianceReport,
} = require('../controllers/adminTripController');

const requireAdminAuth = require('../middleware/adminAuth'); // FIXED

const router = express.Router();

router.use(requireAdminAuth);

router.get('/trips', listTrips);
router.get('/trips/monitor', getTripMonitoringMap);
router.get('/reports/compliance', getComplianceReport);

module.exports = router;