const express = require('express');
const router = express.Router();
const rydinexMapIntelligenceService = require('../services/rydinexMapIntelligenceService');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/rydinex-map-intelligence/route
 * Get complete map intelligence for a route
 */
router.post('/route', authenticateToken, async (req, res) => {
  try {
    const { routeCoordinates } = req.body;

    if (!routeCoordinates || !Array.isArray(routeCoordinates)) {
      return res.status(400).json({
        error: 'routeCoordinates array required',
      });
    }

    const intelligence = await rydinexMapIntelligenceService.getRouteIntelligence(routeCoordinates);

    res.json({
      success: true,
      data: intelligence,
    });
  } catch (error) {
    console.error('Error getting route intelligence:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-map-intelligence/pickup-points
 * Get smart pickup points for a location
 */
router.get('/pickup-points', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const points = await rydinexMapIntelligenceService.getSmartPickupPoints(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      count: points.length,
      data: points,
    });
  } catch (error) {
    console.error('Error getting pickup points:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-map-intelligence/urban-warnings
 * Get urban zone warnings
 */
router.get('/urban-warnings', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const warnings = await rydinexMapIntelligenceService.getUrbanZoneWarnings(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      count: warnings.length,
      data: warnings,
    });
  } catch (error) {
    console.error('Error getting warnings:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-map-intelligence/parking
 * Get parking information
 */
router.get('/parking', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const parking = await rydinexMapIntelligenceService.getParkingInformation(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      data: parking,
    });
  } catch (error) {
    console.error('Error getting parking info:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-map-intelligence/speed-limit
 * Get speed limit for location
 */
router.get('/speed-limit', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const speedLimit = await rydinexMapIntelligenceService.getSpeedLimit(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      data: { speedLimit },
    });
  } catch (error) {
    console.error('Error getting speed limit:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-map-intelligence/risky-locations
 * Get risky intersections
 */
router.get('/risky-locations', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, radius = 2 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const risky = await rydinexMapIntelligenceService.getRiskyLocations(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );

    res.json({
      success: true,
      count: risky.length,
      data: risky,
    });
  } catch (error) {
    console.error('Error getting risky locations:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-map-intelligence/special-zones
 * Get airport/special zone routing rules
 */
router.get('/special-zones', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const rules = await rydinexMapIntelligenceService.getSpecialZoneRules(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Error getting special zones:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-map-intelligence/landmarks
 * Get nearby landmarks
 */
router.get('/landmarks', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const landmarks = await rydinexMapIntelligenceService.getNearbyLandmarks(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      count: landmarks.length,
      data: landmarks,
    });
  } catch (error) {
    console.error('Error getting landmarks:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rydinex-map-intelligence/elevation
 * Get elevation profile for route
 */
router.post('/elevation', authenticateToken, async (req, res) => {
  try {
    const { routeCoordinates } = req.body;

    if (!routeCoordinates || !Array.isArray(routeCoordinates)) {
      return res.status(400).json({
        error: 'routeCoordinates array required',
      });
    }

    const elevation = await rydinexMapIntelligenceService.getElevationProfile(routeCoordinates);

    res.json({
      success: true,
      count: elevation.length,
      data: elevation,
    });
  } catch (error) {
    console.error('Error getting elevation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rydinex-map-intelligence/context
 * Get context intelligence
 */
router.get('/context', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude required',
      });
    }

    const context = await rydinexMapIntelligenceService.getContextIntelligence(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error('Error getting context:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
