const express = require('express');
const { requireAdminAuth } = require('../middleware/adminAuth');
const {
  getPricingConfig,
  updatePricing,
  getSurgeConfig,
  updateSurge,
} = require('../controllers/adminConfigController');

const router = express.Router();

router.use(requireAdminAuth);

router.get('/pricing', getPricingConfig);
router.put('/pricing', updatePricing);
router.get('/surge', getSurgeConfig);
router.put('/surge', updateSurge);

module.exports = router;
