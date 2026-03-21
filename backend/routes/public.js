const express = require('express');
const { getNetworkOverview } = require('../controllers/publicController');

const router = express.Router();

router.get('/network-overview', getNetworkOverview);

module.exports = router;
