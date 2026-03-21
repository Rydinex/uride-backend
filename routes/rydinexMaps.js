const express = require('express');
const router = express.Router();
const rydinexMapsService = require('../services/rydinexMapsService');
const { verifyToken } = require('../middleware/auth');

/**
 * Record location for a trip
 * POST /api/rydinex-maps/location/record
 */
router.post('/location/record', verifyToken, async (req, res) => {
  try {
    const { tripId, latitude, longitude, accuracy, speed, heading, altitude } = req.body;
    const driverId = req.user.id;

    if (!tripId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: 'Missing required fields: tripId, latitude, longitude',
      });
    }

    const location = await rydinexMapsService.recordLocation(tripId, driverId, {
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      altitude,
    });

    return res.status(200).json({
      message: 'Location recorded',
      location,
    });
  } catch (error) {
    console.error('Error recording location:', error);
    return res.status(500).json({
      message: 'Failed to record location',
      error: error.message,
    });
  }
});

/**
 * Get trip polyline
 * GET /api/rydinex-maps/trip/:tripId/polyline
 */
router.get('/trip/:tripId/polyline', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;

    const polyline = await rydinexMapsService.getTripPolyline(tripId);

    return res.status(200).json({
      tripId,
      pointCount: polyline.length,
      polyline,
    });
  } catch (error) {
    console.error('Error fetching polyline:', error);
    return res.status(500).json({
      message: 'Failed to fetch polyline',
      error: error.message,
    });
  }
});

/**
 * Get trip statistics
 * GET /api/rydinex-maps/trip/:tripId/stats
 */
router.get('/trip/:tripId/stats', verifyToken, async (req, res) => {
  try {
    const { tripId } = req.params;

    const stats = await rydinexMapsService.getTripStats(tripId);

    return res.status(200).json({
      tripId,
      stats,
    });
  } catch (error) {
    console.error('Error fetching trip stats:', error);
    return res.status(500).json({
      message: 'Failed to fetch trip stats',
      error: error.message,
    });
  }
});

/**
 * Get last known location
 * GET /api/rydinex-maps/driver/:driverId/location
 */
router.get('/driver/:driverId/location', verifyToken, async (req, res) => {
  try {
    const { driverId } = req.params;

    const location = await rydinexMapsService.getLastLocation(driverId);

    return res.status(200).json({
      driverId,
      location,
    });
  } catch (error) {
    console.error('Error fetching last location:', error);
    return res.status(500).json({
      message: 'Failed to fetch location',
      error: error.message,
    });
  }
});

/**
 * Get location history for date range
 * GET /api/rydinex-maps/history?driverId=X&startDate=Y&endDate=Z
 */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { driverId, startDate, endDate, limit = 1000 } = req.query;

    if (!driverId || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Missing required query parameters: driverId, startDate, endDate',
      });
    }

    const history = await rydinexMapsService.getLocationHistory(
      driverId,
      startDate,
      endDate,
      parseInt(limit)
    );

    return res.status(200).json({
      driverId,
      startDate,
      endDate,
      pointCount: history.length,
      history,
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({
      message: 'Failed to fetch history',
      error: error.message,
    });
  }
});

/**
 * Calculate distance and ETA
 * POST /api/rydinex-maps/calculate
 */
router.post('/calculate', (req, res) => {
  try {
    const { lat1, lon1, lat2, lon2, speedKmh } = req.body;

    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
      return res.status(400).json({
        message: 'Missing required coordinates',
      });
    }

    const distance = rydinexMapsService.calculateDistance(lat1, lon1, lat2, lon2);
    const eta = speedKmh ? rydinexMapsService.estimateETA(distance, speedKmh) : null;

    return res.status(200).json({
      distance: parseFloat(distance.toFixed(2)),
      distanceUnit: 'km',
      eta,
      etaUnit: 'minutes',
    });
  } catch (error) {
    console.error('Error calculating distance:', error);
    return res.status(500).json({
      message: 'Failed to calculate distance',
      error: error.message,
    });
  }
});

module.exports = router;
