const express = require('express');
const {
	listDrivers,
	reviewDriver,
	reviewDriverDocument,
	getDriverComplianceStatus,
} = require('../controllers/adminDriverController');
const { requireAdminAuth } = require('../middleware/adminAuth');

const router = express.Router();

router.use(requireAdminAuth);

router.get('/drivers', listDrivers);
router.patch('/drivers/:driverId/review', reviewDriver);
router.patch('/drivers/:driverId/documents/status', reviewDriverDocument);
router.get('/drivers/:driverId/compliance-status', getDriverComplianceStatus);

module.exports = router;
