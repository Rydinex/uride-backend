const express = require('express');
const router = express.Router();
const rydinexRoutingService = require('../services/rydinexRoutingService');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/rydinex-routing/calculate
 * Calculate route between waypoints
 * Body: waypoints (array of {latitude, longitude, name})
 */
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { waypoints, options = {} } = req.body;

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({
        error: 'At least 2 waypoints required (pickup and dropoff)',
      });
    }

    const route = await rydinexRoutingService.calculateRoute(waypoints, options);

    res.json({
      success: true,
      data: route,
    });
  } catch (error) {
    console.error('Error calculating route:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate route',
    });
  }
});

/**
 * POST /api/rydinex-routing/distance
 * Get distance and ETA between two points
 * Body: {latitude1, longitude1, latitude2, longitude2}
 */
router.post('/distance', authenticateToken, async (req, res) => {
  try {
    const { latitude1, longitude1, latitude2, longitude2 } = req.body;

    if (!latitude1 || !longitude1 || !latitude2 || !longitude2) {
      return res.status(400).json({
        error: 'Missing coordinates',
      });
    }

    const distance = await rydinexRoutingService.getDistance(
      latitude1,
      longitude1,
      latitude2,
      longitude2
    );

    res.json({
      success: true,
      data: distance,
    });
  } catch (error) {
    console.error('Error getting distance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get distance',
    });
  }
});

/**
 * POST /api/rydinex-routing/matrix
 * Get distance matrix between multiple points
 * Useful for finding nearest driver or multi-stop optimization
 * Body: {locations: [{latitude, longitude}, ...]}
 */
router.post('/matrix', authenticateToken, async (req, res) => {
  try {
    const { locations } = req.body;

    if (!locations || !Array.isArray(locations) || locations.length < 2) {
      return res.status(400).json({
        error: 'At least 2 locations required',
      });
    }

    const matrix = await rydinexRoutingService.getDistanceMatrix(locations);

    res.json({
      success: true,
      data: matrix,
    });
  } catch (error) {
    console.error('Error getting distance matrix:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get distance matrix',
    });
  }
});

/**
 * POST /api/rydinex-routing/optimize
 * Optimize waypoint order for multi-stop trips
 * Body: {waypoints: [{latitude, longitude, name}, ...]}
 */
router.post('/optimize', authenticateToken, async (req, res) => {
  try {
    const { waypoints } = req.body;

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({
        error: 'At least 2 waypoints required',
      });
    }

    const optimized = await rydinexRoutingService.optimizeRoute(waypoints);

    res.json({
      success: true,
      data: optimized,
    });
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to optimize route',
    });
  }
});

/**
 * POST /api/rydinex-routing/create
 * Create a route in the database
 * Body: Route data from calculateRoute response
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { tripId, driverId, riderId, ...routeData } = req.body;

    if (!tripId || !driverId) {
      return res.status(400).json({
        error: 'tripId and driverId required',
      });
    }

    const route = await rydinexRoutingService.createRoute({
      tripId,
      driverId,
      riderId,
      ...routeData,
    });

    res.json({
      success: true,
      data: route,
    });
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create route',
    });
  }
});

/**
 * PATCH /api/rydinex-routing/:routeId/progress
 * Update current progress along route
 * Body: {latitude, longitude}
 */
router.patch('/:routeId/progress', authenticateToken, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing current location',
      });
    }

    const route = await rydinexRoutingService.updateProgress(routeId, {
      latitude,
      longitude,
    });

    res.json({
      success: true,
      data: route,
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update progress',
    });
  }
});

/**
 * GET /api/rydinex-routing/:routeId/next-instruction
 * Get next turn instruction
 */
router.get('/:routeId/next-instruction', authenticateToken, async (req, res) => {
  try {
    const { routeId } = req.params;

    const instruction = await rydinexRoutingService.getNextInstruction(routeId);

    res.json({
      success: true,
      data: instruction,
    });
  } catch (error) {
    console.error('Error getting next instruction:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get next instruction',
    });
  }
});

/**
 * GET /api/rydinex-routing/:routeId
 * Get full route details
 */
router.get('/:routeId', authenticateToken, async (req, res) => {
  try {
    const { routeId } = req.params;
    const Route = require('../models/Route');

    const route = await Route.findById(routeId);

    if (!route) {
      return res.status(404).json({
        error: 'Route not found',
      });
    }

    res.json({
      success: true,
      data: route,
    });
  } catch (error) {
    console.error('Error getting route:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get route',
    });
  }
});

/**
 * POST /api/rydinex-routing/:routeId/complete
 * Mark route as completed
 */
router.post('/:routeId/complete', authenticateToken, async (req, res) => {
  try {
    const { routeId } = req.params;

    const route = await rydinexRoutingService.completeRoute(routeId);

    res.json({
      success: true,
      data: route,
    });
  } catch (error) {
    console.error('Error completing route:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete route',
    });
  }
});

module.exports = router;
