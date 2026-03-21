const express = require('express');
const router = express.Router();
const rydinexAIPoiService = require('../services/rydinexAIPoiService');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/rydinex-poi/nearby
 * Find POI near current location
 * Query params: latitude, longitude, radius, category, minRating, limit
 */
router.get('/nearby', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, radius = 2, category = null, minRating = 0, limit = 10 } =
      req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing latitude or longitude',
      });
    }

    const nearbyPOI = await rydinexAIPoiService.findNearbyPOI(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius),
      {
        category,
        minRating: parseFloat(minRating),
        limit: parseInt(limit),
        aiSmart: true,
      }
    );

    res.json({
      success: true,
      count: nearbyPOI.length,
      data: nearbyPOI,
    });
  } catch (error) {
    console.error('Error in GET /nearby:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby POI',
    });
  }
});

/**
 * GET /api/rydinex-poi/route-recommendations
 * Get POI recommendations along a route
 * Body: routePoints (array of [lat, lon]), preferences
 */
router.post('/route-recommendations', authenticateToken, async (req, res) => {
  try {
    const { routePoints, preferences = {} } = req.body;

    if (!routePoints || !Array.isArray(routePoints) || routePoints.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid routePoints array',
      });
    }

    const recommendations = await rydinexAIPoiService.getRouteRecommendations(
      routePoints,
      preferences
    );

    res.json({
      success: true,
      count: recommendations.length,
      data: recommendations,
    });
  } catch (error) {
    console.error('Error in POST /route-recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations',
    });
  }
});

/**
 * GET /api/rydinex-poi/search
 * Search POI by name/address
 * Query params: search, latitude, longitude, radius, limit
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { search, latitude = null, longitude = null, radius = 5, limit = 10 } = req.query;

    if (!search) {
      return res.status(400).json({
        error: 'Missing search parameter',
      });
    }

    const results = await rydinexAIPoiService.searchPOI(search, {
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radiusKm: parseFloat(radius),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error('Error in GET /search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search POI',
    });
  }
});

/**
 * GET /api/rydinex-poi/category/:category
 * Get POI by category
 * Query params: latitude, longitude, radius, limit
 */
router.get('/category/:category', authenticateToken, async (req, res) => {
  try {
    const { category } = req.params;
    const { latitude = null, longitude = null, radius = 5, limit = 20 } = req.query;

    const validCategories = [
      'restaurant',
      'gas_station',
      'hospital',
      'hotel',
      'pharmacy',
      'atm',
      'parking',
      'car_wash',
      'bank',
      'grocery',
      'charging_station',
      'emergency',
      'cafe',
      'bar',
      'other',
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Valid options: ${validCategories.join(', ')}`,
      });
    }

    const poiByCategory = await rydinexAIPoiService.getPOIByCategory(category, {
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radiusKm: parseFloat(radius),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      category,
      count: poiByCategory.length,
      data: poiByCategory,
    });
  } catch (error) {
    console.error('Error in GET /category/:category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch POI by category',
    });
  }
});

/**
 * GET /api/rydinex-poi/emergency
 * Get emergency services nearby
 * Query params: latitude, longitude, radius
 */
router.get('/emergency', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing latitude or longitude',
      });
    }

    const emergencyServices = await rydinexAIPoiService.getEmergencyServices(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );

    res.json({
      success: true,
      count: emergencyServices.length,
      data: emergencyServices,
    });
  } catch (error) {
    console.error('Error in GET /emergency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch emergency services',
    });
  }
});

/**
 * POST /api/rydinex-poi/visit
 * Log POI visit for analytics
 * Body: poiId
 */
router.post('/visit', authenticateToken, async (req, res) => {
  try {
    const { poiId } = req.body;
    const userId = req.user?.id;

    if (!poiId) {
      return res.status(400).json({
        error: 'Missing poiId',
      });
    }

    await rydinexAIPoiService.logPOIVisit(poiId, userId);

    res.json({
      success: true,
      message: 'Visit logged',
    });
  } catch (error) {
    console.error('Error in POST /visit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log visit',
    });
  }
});

module.exports = router;
