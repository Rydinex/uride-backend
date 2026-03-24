const express = require('express');
const router = express.Router();
const rydinexGeocodingService = require('../services/rydinexGeocodingService');
const { verifyToken } = require('../middleware/auth');

/**
 * POST /api/rydinex-geocoding/geocode
 * Convert address to coordinates
 */
router.post('/geocode', verifyToken, async (req, res) => {
  try {
    const { address, countryCode = null, limit = 5 } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const results = await rydinexGeocodingService.geocodeAddress(address, {
      limit,
      countryCode,
    });

    if (results.results.length > 0) {
      await rydinexGeocodingService.trackUsage(
        req.user?.id,
        address,
        results.results[0]
      );
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error geocoding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to geocode address',
    });
  }
});

/**
 * POST /api/rydinex-geocoding/reverse
 * Convert coordinates to address
 */
router.post('/reverse', verifyToken, async (req, res) => {
  try {
    const { latitude, longitude, zoom = 18 } = req.body;

    if (
      latitude === null ||
      longitude === null ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        error: 'Latitude and longitude are required',
      });
    }

    const result = await rydinexGeocodingService.reverseGeocode(latitude, longitude, {
      zoom,
    });

    await rydinexGeocodingService.trackUsage(
      req.user?.id,
      `${latitude},${longitude}`,
      result.result
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reverse geocode',
    });
  }
});

/**
 * POST /api/rydinex-geocoding/batch/geocode
 */
router.post('/batch/geocode', verifyToken, async (req, res) => {
  try {
    const { addresses, limit = 5, countryCode = null } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    const results = await rydinexGeocodingService.batchGeocode(addresses, {
      limit,
      countryCode,
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Error batch geocoding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to batch geocode',
    });
  }
});

/**
 * POST /api/rydinex-geocoding/batch/reverse
 */
router.post('/batch/reverse', verifyToken, async (req, res) => {
  try {
    const { coordinates, zoom = 18 } = req.body;

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({ error: 'Coordinates array is required' });
    }

    const results = await rydinexGeocodingService.batchReverseGeocode(coordinates, {
      zoom,
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Error batch reverse geocoding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to batch reverse geocode',
    });
  }
});

/**
 * GET /api/rydinex-geocoding/autocomplete
 */
router.get('/autocomplete', verifyToken, async (req, res) => {
  try {
    const { q, limit = 5, countryCode = null } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'Query parameter "q" is required',
      });
    }

    const results = await rydinexGeocodingService.autocomplete(q, {
      limit: parseInt(limit),
      countryCode,
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Error autocompleting:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to autocomplete',
    });
  }
});

/**
 * GET /api/rydinex-geocoding/place/:placeId
 */
router.get('/place/:placeId', verifyToken, async (req, res) => {
  try {
    const { placeId } = req.params;
    const { zoom = 18 } = req.query;

    if (!placeId) {
      return res.status(400).json({ error: 'Place ID is required' });
    }

    const result = await rydinexGeocodingService.getPlaceDetails(parseInt(placeId), {
      zoom: parseInt(zoom),
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting place details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get place details',
    });
  }
});

/**
 * GET /api/rydinex-geocoding/nearest
 */
router.get('/nearest', verifyToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude are required',
      });
    }

    const result = await rydinexGeocodingService.findNearestAddress(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error finding nearest address:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to find nearest address',
    });
  }
});

/**
 * GET /api/rydinex-geocoding/popular
 */
router.get('/popular', verifyToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const results = await rydinexGeocodingService.getPopularLocations(parseInt(limit));

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Error getting popular locations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get popular locations',
    });
  }
});

module.exports = router;