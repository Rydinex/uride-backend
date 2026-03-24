const express = require('express');
const {
  getPricingConfig,
  updatePricing,
  getSurgeConfig,
  updateSurge,
} = require('../controllers/adminConfigController');

const requireAdminAuth = require('../middleware/adminAuth'); // FIXED

const router = express.Router();

router.use(requireAdminAuth);

router.get('/pricing', getPricingConfig);
router.put('/pricing', updatePricing);
router.get('/surge', getSurgeConfig);
router.put('/surge', updateSurge);

module.exports = router;