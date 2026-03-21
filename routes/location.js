const express = require('express');
const { getNearbyDrivers } = require('../controllers/locationController');
const { validateNearbyDriversQuery } = require('../middleware/requestValidation');

const router = express.Router();

router.get('/nearby', validateNearbyDriversQuery, getNearbyDrivers);

module.exports = router;
