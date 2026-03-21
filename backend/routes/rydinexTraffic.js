const express = require('express');
const router = express.Router();
const rydinexTrafficService = require('../services/rydinexTrafficService');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/rydinex-traffic/report
 * Report traffic/speed data from a driver
 * Body: {latitude, longitude, speed, driverId, accuracy}
 */
router.post('/report', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, speed, driverId, accuracy } = req.body;

    if (!latitude || !longitude || speed === undefined || !driverId) {
      return res.status(400).json({
        error: 'Missing required fields: latitude, longitude, speed, driverId',
      });
    }

    const traffic = await rydinexTrafficService.reportTrafficData({
      latitude,
      longitude,
      speed,
      driverId,
      accuracy,
    });

    res.json({
      success: true,
      data: {
        congestionLevel: traffic.congestionLevel,
        congestionScore: traffic.congestionScore,
        currentSpeed: traffic.currentSpeed,
        sampleCount: traffic.sampleCount,
      },
    });
  } catch (error) {
    console.error('Error reporting traffic:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rydinex-traffic/route
 * Get traffic data for a route
 * Body: {routeCoordinates: [[lat, lon], [lat, lon], ...]}
 */
router.post('/route', authenticateToken, async (req, res) => {
  try {
    const { routeCoordinates } = req.body;

    if (!routeCoordinates || !Array.isArray(routeCoordinates)) {
      return res.status(400).json({
        error: 'routeCoordinates array is required',
      });
    }

    const traffic = await rydinexTrafficService.getTrafficForRoute(routeCoordinates);

    res.json({
      success: true,
      data: traffic,
    });
  } catch (error) {
    console.error('Error getting route traffic:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-traffic/heatmap
 * Get traffic heatmap for an area
 * Query: {latitude, longitude, radius (km)}
 */
router.get('/heatmap', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, radius = 2 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const heatmap = await rydinexTrafficService.getTrafficHeatmap(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );

    res.json({
      success: true,
      count: heatmap.length,
      data: heatmap,
    });
  } catch (error) {
    console.error('Error getting heatmap:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rydinex-traffic/incident
 * Report an incident (accident, construction, etc.)
 * Body: {latitude, longitude, type, description, severity, reportedBy}
 */
router.post('/incident', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, type, description, severity, reportedBy } = req.body;

    if (!latitude || !longitude || !type) {
      return res.status(400).json({
        error: 'Missing required fields',
      });
    }

    const result = await rydinexTrafficService.reportIncident({
      latitude,
      longitude,
      type,
      description,
      severity: severity || 'moderate',
      reportedBy: reportedBy || req.user?.id,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error reporting incident:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-traffic/predict
 * Get predicted traffic for a time/location
 * Query: {latitude, longitude, time (optional ISO string)}
 */
router.get('/predict', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, time } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const predictFor = time ? new Date(time) : new Date();

    const prediction = await rydinexTrafficService.getPredictedTraffic(
      parseFloat(latitude),
      parseFloat(longitude),
      predictFor
    );

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: 'No traffic data available for this location',
      });
    }

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    console.error('Error predicting traffic:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-traffic/congested-roads
 * Get top congested roads in the area
 * Query: {limit}
 */
router.get('/congested-roads', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const roads = await rydinexTrafficService.getTopCongestedRoads(parseInt(limit));

    res.json({
      success: true,
      count: roads.length,
      data: roads,
    });
  } catch (error) {
    console.error('Error getting congested roads:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
