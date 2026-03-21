const rydinexRoutingService = require('../services/rydinexRoutingService');
const Route = require('../models/Route');

/**
 * Register Socket.IO handlers for real-time turn-by-turn navigation
 */
function registerRydinexRoutingSocketHandlers(io) {
  const namespace = io.of('/rydinex-routing');

  namespace.on('connection', socket => {
    console.log('[Routing] User connected:', socket.id);

    /**
     * Start navigation for a trip
     * Emit: {tripId, driverId, riderId, waypoints: [{lat, lon, name}, ...]}
     */
    socket.on('start-navigation', async data => {
      try {
        const { tripId, driverId, riderId, waypoints } = data;

        if (!waypoints || waypoints.length < 2) {
          socket.emit('error', 'At least 2 waypoints required');
          return;
        }

        // Calculate route
        const route = await rydinexRoutingService.calculateRoute(waypoints);

        // Save to database
        const savedRoute = await rydinexRoutingService.createRoute({
          tripId,
          driverId,
          riderId,
          ...route,
        });

        // Emit route to driver
        socket.emit('navigation-started', {
          routeId: savedRoute._id,
          totalDistance: route.totalDistance,
          totalDuration: route.totalDurationMinutes,
          waypoints: route.waypoints,
          segments: route.segments,
          eta: route.eta.originalEta,
        });

        // Broadcast to trip participants
        namespace.emit('navigation-started-broadcast', {
          tripId,
          driverId,
          routeId: savedRoute._id,
          totalDistance: route.totalDistance,
          geometry: route.decodedGeometry,
        });

        console.log(`[Routing] Navigation started for trip ${tripId}`);
      } catch (error) {
        console.error('[Routing] Error starting navigation:', error);
        socket.emit('error', error.message);
      }
    });

    /**
     * Update driver location during navigation
     * Emit: {routeId, latitude, longitude}
     */
    socket.on('location-update', async data => {
      try {
        const { routeId, latitude, longitude } = data;

        // Update progress
        const route = await rydinexRoutingService.updateProgress(routeId, {
          latitude,
          longitude,
        });

        // Get next instruction
        const nextInstruction = await rydinexRoutingService.getNextInstruction(routeId);

        // Emit updated progress
        socket.emit('navigation-progress', {
          routeId,
          progress: {
            distanceTraveled: route.currentProgress.distanceTraveled,
            remainingDistance: route.currentProgress.remainingDistance,
            remainingDuration: route.currentProgress.remainingDuration,
            currentSegmentIndex: route.currentProgress.currentSegmentIndex,
          },
          nextInstruction,
          eta: route.eta.currentEta,
          estimatedArrivalTime: route.eta.estimatedArrivalTime,
        });

        // Broadcast location to riders
        namespace.emit('driver-location-update', {
          tripId: route.tripId,
          driverId: route.driverId,
          latitude,
          longitude,
          eta: route.eta.currentEta,
        });
      } catch (error) {
        console.error('[Routing] Error updating location:', error);
        socket.emit('error', error.message);
      }
    });

    /**
     * Get current navigation state
     * Emit: {routeId}
     */
    socket.on('get-navigation-state', async data => {
      try {
        const { routeId } = data;

        const route = await Route.findById(routeId);
        if (!route) {
          socket.emit('error', 'Route not found');
          return;
        }

        const nextInstruction = await rydinexRoutingService.getNextInstruction(routeId);

        socket.emit('navigation-state', {
          routeId,
          status: route.isActive ? 'active' : route.isPaused ? 'paused' : 'completed',
          progress: route.currentProgress,
          nextInstruction,
          eta: route.eta.currentEta,
          totalDistance: route.totalDistance,
          totalDuration: route.totalDurationMinutes,
        });
      } catch (error) {
        console.error('[Routing] Error getting state:', error);
        socket.emit('error', error.message);
      }
    });

    /**
     * Pause navigation
     * Emit: {routeId}
     */
    socket.on('pause-navigation', async data => {
      try {
        const { routeId } = data;

        const route = await Route.findById(routeId);
        if (!route) throw new Error('Route not found');

        route.isPaused = true;
        await route.save();

        socket.emit('navigation-paused', {
          routeId,
          message: 'Navigation paused',
        });

        namespace.emit('navigation-paused-broadcast', {
          tripId: route.tripId,
          routeId,
        });
      } catch (error) {
        console.error('[Routing] Error pausing navigation:', error);
        socket.emit('error', error.message);
      }
    });

    /**
     * Resume navigation
     * Emit: {routeId}
     */
    socket.on('resume-navigation', async data => {
      try {
        const { routeId } = data;

        const route = await Route.findById(routeId);
        if (!route) throw new Error('Route not found');

        route.isPaused = false;
        await route.save();

        socket.emit('navigation-resumed', {
          routeId,
          message: 'Navigation resumed',
        });

        namespace.emit('navigation-resumed-broadcast', {
          tripId: route.tripId,
          routeId,
        });
      } catch (error) {
        console.error('[Routing] Error resuming navigation:', error);
        socket.emit('error', error.message);
      }
    });

    /**
     * Reroute (recalculate route)
     * Emit: {routeId, waypoints: [{lat, lon, name}, ...]}
     */
    socket.on('reroute', async data => {
      try {
        const { routeId, waypoints } = data;

        if (!waypoints || waypoints.length < 2) {
          socket.emit('error', 'At least 2 waypoints required');
          return;
        }

        // Calculate new route
        const route = await rydinexRoutingService.calculateRoute(waypoints);

        // Update database
        const updatedRoute = await Route.findByIdAndUpdate(
          routeId,
          {
            ...route,
            optimized: true,
            optimizationReason: 'user_request',
            updatedAt: new Date(),
          },
          { new: true }
        );

        socket.emit('reroute-complete', {
          routeId,
          totalDistance: route.totalDistance,
          totalDuration: route.totalDurationMinutes,
          eta: route.eta.originalEta,
          message: 'Route updated',
        });

        namespace.emit('reroute-broadcast', {
          tripId: updatedRoute.tripId,
          routeId,
          newDistance: route.totalDistance,
        });
      } catch (error) {
        console.error('[Routing] Error rerouting:', error);
        socket.emit('error', error.message);
      }
    });

    /**
     * Complete navigation
     * Emit: {routeId}
     */
    socket.on('complete-navigation', async data => {
      try {
        const { routeId } = data;

        const route = await rydinexRoutingService.completeRoute(routeId);

        socket.emit('navigation-completed', {
          routeId,
          totalDistance: route.totalDistance,
          totalDuration: route.totalDurationMinutes,
          completedAt: route.completedAt,
        });

        namespace.emit('navigation-completed-broadcast', {
          tripId: route.tripId,
          routeId,
        });

        console.log(`[Routing] Navigation completed for route ${routeId}`);
      } catch (error) {
        console.error('[Routing] Error completing navigation:', error);
        socket.emit('error', error.message);
      }
    });

    /**
     * Join route room for real-time updates
     * Emit: {routeId}
     */
    socket.on('join-route', data => {
      const { routeId } = data;
      socket.join(`route-${routeId}`);
      console.log(`[Routing] User joined route ${routeId}`);
    });

    /**
     * Leave route room
     * Emit: {routeId}
     */
    socket.on('leave-route', data => {
      const { routeId } = data;
      socket.leave(`route-${routeId}`);
      console.log(`[Routing] User left route ${routeId}`);
    });

    socket.on('disconnect', () => {
      console.log('[Routing] User disconnected:', socket.id);
    });
  });
}

module.exports = { registerRydinexRoutingSocketHandlers };
