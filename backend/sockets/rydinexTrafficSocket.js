const rydinexTrafficService = require('../services/rydinexTrafficService');

/**
 * Register Socket.IO handlers for real-time traffic
 */
function registerRydinexTrafficSocketHandlers(io) {
  const namespace = io.of('/rydinex-traffic');

  namespace.on('connection', socket => {
    console.log('[Traffic] User connected:', socket.id);

    /**
     * Report speed data (drivers send this continuously)
     * Emit: {latitude, longitude, speed, driverId, accuracy}
     */
    socket.on('report-speed', async data => {
      try {
        const traffic = await rydinexTrafficService.reportTrafficData(data);

        // Broadcast congestion update to subscribers in this area
        namespace.emit('congestion-update', {
          latitude: traffic.coordinates.coordinates[1],
          longitude: traffic.coordinates.coordinates[0],
          congestionLevel: traffic.congestionLevel,
          congestionScore: traffic.congestionScore,
          currentSpeed: traffic.currentSpeed,
          sampleCount: traffic.sampleCount,
        });

        // Send ack to driver
        socket.emit('speed-reported', {
          success: true,
          congestionLevel: traffic.congestionLevel,
        });
      } catch (error) {
        console.error('[Traffic] Error reporting speed:', error);
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Subscribe to traffic updates for an area
     * Emit: {latitude, longitude, radius}
     */
    socket.on('subscribe-area', data => {
      const { latitude, longitude, radius = 2 } = data;
      const roomName = `traffic-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}`;

      socket.join(roomName);
      socket.emit('subscribed', {
        room: roomName,
        message: `Subscribed to traffic updates for area`,
      });

      console.log(`[Traffic] User subscribed to ${roomName}`);
    });

    /**
     * Get current heatmap for area
     * Emit: {latitude, longitude, radius}
     */
    socket.on('get-heatmap', async data => {
      try {
        const { latitude, longitude, radius = 2 } = data;

        const heatmap = await rydinexTrafficService.getTrafficHeatmap(
          latitude,
          longitude,
          radius
        );

        socket.emit('heatmap-data', {
          success: true,
          count: heatmap.length,
          data: heatmap,
        });
      } catch (error) {
        console.error('[Traffic] Error getting heatmap:', error);
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Report incident
     * Emit: {latitude, longitude, type, description, severity}
     */
    socket.on('report-incident', async data => {
      try {
        const result = await rydinexTrafficService.reportIncident({
          ...data,
          reportedBy: socket.handshake.auth?.userId,
        });

        // Broadcast incident to all users
        namespace.emit('incident-reported', {
          latitude: data.latitude,
          longitude: data.longitude,
          type: data.type,
          description: data.description,
          severity: data.severity,
          affectedSegments: result.affectedSegments,
        });

        socket.emit('incident-acknowledged', {
          success: true,
          message: `Incident reported and affecting ${result.affectedSegments} segments`,
        });
      } catch (error) {
        console.error('[Traffic] Error reporting incident:', error);
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Get traffic for route
     * Emit: {routeCoordinates: [[lat, lon], ...]}
     */
    socket.on('get-route-traffic', async data => {
      try {
        const { routeCoordinates } = data;

        const traffic = await rydinexTrafficService.getTrafficForRoute(routeCoordinates);

        socket.emit('route-traffic-data', {
          success: true,
          data: traffic,
        });
      } catch (error) {
        console.error('[Traffic] Error getting route traffic:', error);
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Get predicted traffic
     * Emit: {latitude, longitude, time (optional)}
     */
    socket.on('get-prediction', async data => {
      try {
        const { latitude, longitude, time } = data;

        const prediction = await rydinexTrafficService.getPredictedTraffic(
          latitude,
          longitude,
          time ? new Date(time) : new Date()
        );

        socket.emit('traffic-prediction', {
          success: true,
          data: prediction,
        });
      } catch (error) {
        console.error('[Traffic] Error predicting traffic:', error);
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Get congested roads
     * Emit: {limit}
     */
    socket.on('get-congested-roads', async data => {
      try {
        const { limit = 10 } = data;

        const roads = await rydinexTrafficService.getTopCongestedRoads(limit);

        socket.emit('congested-roads-data', {
          success: true,
          count: roads.length,
          data: roads,
        });
      } catch (error) {
        console.error('[Traffic] Error getting congested roads:', error);
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Unsubscribe from area
     * Emit: {latitude, longitude}
     */
    socket.on('unsubscribe-area', data => {
      const { latitude, longitude } = data;
      const roomName = `traffic-${Math.round(latitude * 1000)}-${Math.round(longitude * 1000)}`;

      socket.leave(roomName);
      console.log(`[Traffic] User unsubscribed from ${roomName}`);
    });

    socket.on('disconnect', () => {
      console.log('[Traffic] User disconnected:', socket.id);
    });
  });
}

module.exports = { registerRydinexTrafficSocketHandlers };
