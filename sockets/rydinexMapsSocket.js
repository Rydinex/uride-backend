const rydinexMapsService = require('../services/rydinexMapsService');
const { getRedisClient } = require('../services/redisClient');

const ACTIVE_TRIPS_KEY = 'rydinex:active_trips';
const TRIP_LOCATIONS_KEY = 'rydinex:trip:locations:';

function registerRydinexMapsSocketHandlers(io) {
  const rydinexNamespace = io.of('/rydinex-maps');

  rydinexNamespace.on('connection', socket => {
    console.log(`[RydinexMaps] New connection: ${socket.id}`);

    /**
     * Join trip room - driver/rider joins to receive live updates
     */
    socket.on('join-trip', async ({ tripId, userId, userType }) => {
      try {
        if (!tripId || !userId) {
          socket.emit('error', { message: 'Missing tripId or userId' });
          return;
        }

        const roomName = `trip:${tripId}`;
        socket.join(roomName);

        // Store in Redis for tracking
        const redisClient = getRedisClient();
        await redisClient.sadd(`${ACTIVE_TRIPS_KEY}`, tripId);
        await redisClient.setex(
          `rydinex:trip:${tripId}:${userType}:${userId}`,
          3600,
          socket.id
        );

        console.log(`[RydinexMaps] ${userType} ${userId} joined trip ${tripId}`);

        socket.emit('trip-joined', {
          tripId,
          message: `Successfully joined trip ${tripId}`,
        });
      } catch (error) {
        console.error('Error joining trip:', error);
        socket.emit('error', { message: 'Failed to join trip' });
      }
    });

    /**
     * Broadcast live location update
     */
    socket.on('location-update', async ({ tripId, latitude, longitude, accuracy, speed, heading, altitude }) => {
      try {
        if (!tripId || latitude === undefined || longitude === undefined) {
          socket.emit('error', { message: 'Missing required location fields' });
          return;
        }

        const driverId = socket.handshake.auth?.driverId || socket.id;

        // Record location in service
        const locationRecord = await rydinexMapsService.recordLocation(tripId, driverId, {
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          altitude,
        });

        // Broadcast to all users in the trip room
        const roomName = `trip:${tripId}`;
        rydinexNamespace.to(roomName).emit('location-updated', {
          tripId,
          driverId,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          altitude,
          timestamp: new Date().toISOString(),
        });

        console.log(`[RydinexMaps] Location update for trip ${tripId}: (${latitude}, ${longitude})`);
      } catch (error) {
        console.error('Error updating location:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    /**
     * Request current trip location
     */
    socket.on('request-location', async ({ tripId }) => {
      try {
        if (!tripId) {
          socket.emit('error', { message: 'Missing tripId' });
          return;
        }

        const polyline = await rydinexMapsService.getTripPolyline(tripId);
        const lastPoint = polyline[polyline.length - 1];

        socket.emit('current-location', {
          tripId,
          location: lastPoint,
          pointCount: polyline.length,
        });
      } catch (error) {
        console.error('Error fetching current location:', error);
        socket.emit('error', { message: 'Failed to fetch location' });
      }
    });

    /**
     * Broadcast location to specific users (driver to rider, etc)
     */
    socket.on('share-location', async ({ tripId, targetUserIds, locationData }) => {
      try {
        if (!tripId || !targetUserIds || !Array.isArray(targetUserIds)) {
          socket.emit('error', { message: 'Invalid share-location data' });
          return;
        }

        const roomName = `trip:${tripId}`;
        rydinexNamespace.to(roomName).emit('shared-location', {
          tripId,
          fromUser: socket.id,
          location: locationData,
          timestamp: new Date().toISOString(),
        });

        socket.emit('location-shared', { message: 'Location shared successfully' });
      } catch (error) {
        console.error('Error sharing location:', error);
        socket.emit('error', { message: 'Failed to share location' });
      }
    });

    /**
     * Get trip stats in real-time
     */
    socket.on('get-trip-stats', async ({ tripId }) => {
      try {
        if (!tripId) {
          socket.emit('error', { message: 'Missing tripId' });
          return;
        }

        const stats = await rydinexMapsService.getTripStats(tripId);

        socket.emit('trip-stats', {
          tripId,
          stats,
        });
      } catch (error) {
        console.error('Error fetching trip stats:', error);
        socket.emit('error', { message: 'Failed to fetch trip stats' });
      }
    });

    /**
     * Leave trip room
     */
    socket.on('leave-trip', ({ tripId }) => {
      try {
        const roomName = `trip:${tripId}`;
        socket.leave(roomName);

        rydinexNamespace.to(roomName).emit('user-left-trip', {
          tripId,
          userId: socket.id,
          timestamp: new Date().toISOString(),
        });

        console.log(`[RydinexMaps] User left trip ${tripId}`);
      } catch (error) {
        console.error('Error leaving trip:', error);
      }
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      console.log(`[RydinexMaps] User disconnected: ${socket.id}`);
    });

    socket.on('error', error => {
      console.error(`[RydinexMaps] Socket error for ${socket.id}:`, error);
    });
  });
}

module.exports = { registerRydinexMapsSocketHandlers };
