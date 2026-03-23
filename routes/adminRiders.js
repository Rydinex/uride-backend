const express = require('express');
const { listRiders, listPaymentLogs } = require('../controllers/adminRiderController');

const requireAdminAuth = require('../middleware/adminAuth'); // FIXED

const router = express.Router();

router.use(requireAdminAuth);

router.get('/riders', listRiders);
router.get('/payment-logs', listPaymentLogs);

module.exports = router;