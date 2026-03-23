const {
  enterAirportQueue,
  exitAirportQueue,
  getDriverAirportQueueStatus,
} = require('../services/airportQueueService');
const {
  normalizeRideCategory,
  getAirportByPoint,
  getORDTerminalByPoint,
  getMDWTerminalByPoint,
  getORDPickupRules,
  getMDWPickupRules,
  getMDWStagingRules,
  getAirportLotByPoint,
  getAirportPickupZoneByPoint,
  getEventByPoint,
  getEventStagingAreaByPoint,
  getEventPickupLaneByPoint,
  getAirportGeofences,
  getEventGeofences,
} = require('../services/airportGeofenceService');
const { createDriverLog, createSafetyLog } = require('../services/complianceLogService');

async function getGeofences(req, res) {
  try {
    return res.status(200).json({
      airports: getAirportGeofences(),
      events: getEventGeofences(),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch operations geofences.' });
  }
}

async function enterQueue(req, res) {
  try {
    const {
      driverId,
      latitude,
      longitude,
      airportCode,
      eventCode,
      queueType,
      rideCategory = 'rydinex_regular',
    } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required.' });
    }

    // Determine queue group based on ride category
    let queueGroup;

    if (['black_car', 'black_suv'].includes(rideCategory)) {
      queueGroup = 'black';
    } else {
      queueGroup = 'standard';
    }

    // MDW staging enforcement
    if (airportCode === 'MDW') {
      const stagingRules = getMDWStagingRules(queueGroup);

      const lotContext = getAirportLotByPoint(
        { latitude, longitude },
        queueGroup
      );

      if (!lotContext || !lotContext.inSelectedLot) {
        return res.status(403).json({
          message: 'Driver must be inside the correct MDW staging lot.',
          requiredLot: stagingRules,
        });
      }
    }

    const queueEntry = await enterAirportQueue({
      driverId,
      latitude,
      longitude,
      airportCode,
      eventCode,
      queueType,
      rideCategory,
      queueGroup,
    });

    await createDriverLog({
      driver: driverId,
      eventType: 'operations_queue_entered',
      actorType: 'driver',
      actorId: String(driverId),
      severity: 'info',
      metadata: {
        queueType: queueEntry?.queueType || null,
        queueGroup: queueEntry?.queueGroup || null,
        airportCode: queueEntry?.airportCode || null,
        eventCode: queueEntry?.eventCode || null,
        lotCode: queueEntry?.lotCode || null,
        stagingAreaCode: queueEntry?.stagingAreaCode || null,
        position: queueEntry?.position || null,
      },
    }).catch(() => null);

    return res.status(200).json({
      message: 'Driver entered operations queue successfully.',
      queueEntry,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to enter operations queue.' });
  }
}

async function exitQueue(req, res) {
  try {
    const { driverId, airportCode, eventCode, queueType, reason } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required.' });
    }

    const queueEntry = await exitAirportQueue({
      driverId,
      airportCode,
      eventCode,
      queueType,
      reason,
    });

    if (queueEntry) {
      await createDriverLog({
        driver: driverId,
        eventType: 'operations_queue_exited',
        actorType: 'driver',
        actorId: String(driverId),
        severity: 'info',
        metadata: {
          queueType: queueEntry.queueType,
          queueGroup: queueEntry.queueGroup,
          airportCode: queueEntry.airportCode,
          eventCode: queueEntry.eventCode,
          reason,
          joinedAt: queueEntry.joinedAt,
          exitedAt: queueEntry.exitedAt,
        },
      }).catch(() => null);

      if (String(reason || '').toLowerCase().includes('unexpected') || String(reason || '').toLowerCase().includes('drop')) {
        await createSafetyLog({
          incidentType: 'operations_queue_anomaly',
          severity: 'medium',
          status: 'open',
          driver: driverId,
          reportedByType: 'system',
          title: 'Operations queue exit anomaly',
          description: `Driver exited queue with reason: ${reason || 'n/a'}`,
          metadata: {
            queueType: queueEntry.queueType,
            airportCode: queueEntry.airportCode,
            eventCode: queueEntry.eventCode,
            queueEntryId: queueEntry.id,
          },
        }).catch(() => null);
      }
    }

    return res.status(200).json({
      message: queueEntry ? 'Driver exited operations queue.' : 'No active queue entry found for driver.',
      queueEntry,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to exit operations queue.' });
  }
}

async function getDriverQueueStatus(req, res) {
  try {
    const { driverId } = req.params;
    const { latitude = null, longitude = null, rideCategory = 'rydinex_regular' } = req.query;

    const status = await getDriverAirportQueueStatus({
      driverId,
      latitude,
      longitude,
      rideCategory,
    });

    return res.status(200).json(status);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to fetch driver queue status.' });
  }
}

async function getAirportPickupInstructions(req, res) {
  try {
    const { latitude, longitude, rideCategory = 'rydinex_regular' } = req.query;
    const queueGroup = normalizeRideCategory(rideCategory);

    const airport = getAirportByPoint({ latitude, longitude });
    if (airport) {
      const terminal = airport.code === 'ORD'
        ? getORDTerminalByPoint({ latitude, longitude })
        : airport.code === 'MDW'
        ? getMDWTerminalByPoint({ latitude, longitude })
        : null;

      let pickupRules = null;

      if (airport.code === 'ORD') {
        pickupRules = getORDPickupRules(terminal, rideCategory);
      }

      if (airport.code === 'MDW') {
        pickupRules = getMDWPickupRules(rideCategory);
      }

      if (pickupRules && !pickupRules.allowed) {
        return res.status(403).json({
          message: pickupRules.reason,
          terminal,
        });
      }

      const lotContext = getAirportLotByPoint({ latitude, longitude }, queueGroup);
      const pickupZoneContext = getAirportPickupZoneByPoint({ latitude, longitude });
      const instructions = airport.pickupInstructions?.[queueGroup] || [];

      return res.status(200).json({
        operationType: 'airport',
        isAirportPickup: true,
        isEventPickup: false,
        airport: {
          code: airport.code,
          name: airport.name,
        },
        event: null,
        terminal,
        queueGroup,
        requiredLot: lotContext
          ? {
              code: lotContext.lotCode,
              name: lotContext.lotName,
              inRequiredLot: Boolean(lotContext.inSelectedLot),
            }
          : null,
        pickupZone: pickupZoneContext
          ? {
              code: pickupZoneContext.zone.code,
              name: pickupZoneContext.zone.name,
              laneType: pickupZoneContext.zone.laneType,
            }
          : null,
        stagingArea: null,
        pickupLane: pickupRules,
        instructions,
      });
    }

    const event = getEventByPoint({ latitude, longitude });
    if (event) {
      const stagingContext = getEventStagingAreaByPoint({ latitude, longitude }, queueGroup);
      const pickupLaneContext = getEventPickupLaneByPoint({ latitude, longitude });

      return res.status(200).json({
        operationType: 'event',
        isAirportPickup: false,
        isEventPickup: true,
        airport: null,
        event: {
          code: event.code,
          name: event.name,
          queueOpen: Boolean(event.queueOpen),
        },
        queueGroup,
        requiredLot: null,
        pickupZone: null,
        stagingArea: stagingContext
          ? {
              code: stagingContext.stagingAreaCode,
              name: stagingContext.stagingAreaName,
              inRequiredStagingArea: Boolean(stagingContext.inStagingArea),
            }
          : null,
        pickupLane: pickupLaneContext
          ? {
              code: pickupLaneContext.lane.code,
              name: pickupLaneContext.lane.name,
              laneType: pickupLaneContext.lane.laneType,
            }
          : null,
        instructions: event.riderInstructions || [],
      });
    }

    return res.status(200).json({
      operationType: 'city',
      isAirportPickup: false,
      isEventPickup: false,
      airport: null,
      event: null,
      queueGroup,
      requiredLot: null,
      pickupZone: null,
      stagingArea: null,
      pickupLane: null,
      instructions: [],
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Failed to fetch pickup instructions.' });
  }
}

module.exports = {
  getGeofences,
  enterQueue,
  exitQueue,
  getDriverQueueStatus,
  getAirportPickupInstructions,
};
