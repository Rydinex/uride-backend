const {
  heartbeatDriver,
  setDriverOffline,
  setDriverOfflineBySocketId,
  queryNearbyDrivers,
} = require('../services/activeDriversStore');

function registerLocationSocketHandlers(io) {
  const nearbySubscriptionIntervals = new Map();

  const joinDriverRoom = (socket, driverId) => {
    if (!driverId || typeof driverId !== 'string') {
      return;
    }

    socket.join(`driver:${driverId}`);
  };

  const leaveDriverRoom = (socket, driverId) => {
    if (!driverId || typeof driverId !== 'string') {
      return;
    }

    socket.leave(`driver:${driverId}`);
  };

  const clearNearbySubscription = socketId => {
    const existingInterval = nearbySubscriptionIntervals.get(socketId);
    if (!existingInterval) {
      return;
    }

    clearInterval(existingInterval);
    nearbySubscriptionIntervals.delete(socketId);
  };

  const emitNearbyDrivers = async (socket, payload) => {
    const drivers = await queryNearbyDrivers({
      latitude: payload.latitude,
      longitude: payload.longitude,
      radiusKm: payload.radiusKm || 5,
      limit: payload.limit || 20,
    });

    socket.emit('nearby:drivers', {
      drivers,
      generatedAt: Date.now(),
    });
  };

  io.on('connection', socket => {
    socket.on('driver:online', async (payload = {}, acknowledgement) => {
      try {
        const heartbeat = await heartbeatDriver({
          driverId: payload.driverId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          socketId: socket.id,
        });

        joinDriverRoom(socket, payload.driverId);

        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: true, heartbeat });
        }
      } catch (error) {
        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: false, message: error.message || 'Failed to go online.' });
        }
      }
    });

    socket.on('driver:heartbeat', async (payload = {}, acknowledgement) => {
      try {
        const heartbeat = await heartbeatDriver({
          driverId: payload.driverId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          socketId: socket.id,
        });

        joinDriverRoom(socket, payload.driverId);

        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: true, heartbeat });
        }
      } catch (error) {
        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: false, message: error.message || 'Failed to send heartbeat.' });
        }
      }
    });

    socket.on('driver:offline', async (payload = {}, acknowledgement) => {
      try {
        if (payload.driverId) {
          await setDriverOffline(payload.driverId);
          leaveDriverRoom(socket, payload.driverId);
        } else {
          await setDriverOfflineBySocketId(socket.id);
        }

        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: true });
        }
      } catch (error) {
        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: false, message: error.message || 'Failed to go offline.' });
        }
      }
    });

    socket.on('driver:subscribeTrips', (payload = {}, acknowledgement) => {
      try {
        if (!payload.driverId || typeof payload.driverId !== 'string') {
          throw new Error('driverId is required.');
        }

        joinDriverRoom(socket, payload.driverId);

        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: true });
        }
      } catch (error) {
        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: false, message: error.message || 'Failed to subscribe to trip stream.' });
        }
      }
    });

    socket.on('driver:unsubscribeTrips', (payload = {}, acknowledgement) => {
      try {
        if (payload.driverId && typeof payload.driverId === 'string') {
          leaveDriverRoom(socket, payload.driverId);
        }

        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: true });
        }
      } catch (error) {
        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: false, message: error.message || 'Failed to unsubscribe from trip stream.' });
        }
      }
    });

    socket.on('rider:subscribeNearby', async (payload = {}, acknowledgement) => {
      try {
        clearNearbySubscription(socket.id);

        await emitNearbyDrivers(socket, payload);

        const intervalId = setInterval(async () => {
          try {
            await emitNearbyDrivers(socket, payload);
          } catch (error) {
            socket.emit('nearby:error', {
              message: error.message || 'Failed to refresh nearby drivers.',
            });
          }
        }, 4000);

        nearbySubscriptionIntervals.set(socket.id, intervalId);

        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: true });
        }
      } catch (error) {
        if (typeof acknowledgement === 'function') {
          acknowledgement({ ok: false, message: error.message || 'Failed to subscribe nearby drivers.' });
        }
      }
    });

    socket.on('rider:unsubscribeNearby', () => {
      clearNearbySubscription(socket.id);
    });

    socket.on('disconnect', async () => {
      clearNearbySubscription(socket.id);
      await setDriverOfflineBySocketId(socket.id).catch(() => null);
    });
  });
}

module.exports = {
  registerLocationSocketHandlers,
};
