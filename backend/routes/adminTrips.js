const express = require('express');
const { requireAdminAuth } = require('../middleware/adminAuth');
const {
  listTrips,
  getTripMonitoringMap,
  getComplianceReport,
} = require('../controllers/adminTripController');

const router = express.Router();

router.use(requireAdminAuth);

router.get('/trips', listTrips);
router.get('/trips/monitor', getTripMonitoringMap);
router.get('/reports/compliance', getComplianceReport);

module.exports = router;
