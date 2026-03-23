const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const AirportQueueEntry = require('../models/AirportQueueEntry');
const {
  AIRPORT_GEOFENCES,
  EVENT_GEOFENCES,
  SUPPORTED_EVENT_CODES,
  normalizeRideCategory,
  getAirportByPoint,
  getAirportLotByPoint,
  getAirportPickupZoneByPoint,
  getEventByPoint,
  getEventStagingAreaByPoint,
  getEventPickupLaneByPoint,
  isEventQueueWindowOpen,
} = require('./airportGeofenceService');
const { evaluateDriverChicagoRequirements } = require('./complianceReportingService');

const ACTIVE_DRIVER_TRIP_STATUSES = ['driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'];
const DEFAULT_AVERAGE_ASSIGNMENT_MINUTES = Number(process.env.AIRPORT_QUEUE_AVG_ASSIGNMENT_MINUTES || 4);
const EVENT_QUEUE_ENTRY_TTL_MINUTES = Number(process.env.EVENT_QUEUE_ENTRY_TTL_MINUTES || 180);
const AIRPORT_QUEUE_STRICT = String(process.env.AIRPORT_QUEUE_STRICT || 'true').toLowerCase() !== 'false';
const EVENT_QUEUE_STRICT = String(process.env.EVENT_QUEUE_STRICT || 'false').toLowerCase() === 'true';

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLocation(location) {
  if (!location || typeof location !== 'object') {
    return null;
  }

  const latitude = toFiniteNumber(location.latitude);
  const longitude = toFiniteNumber(location.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    recordedAt: new Date(),
  };
}

function buildScopeFilter(entryLike) {
  const filter = {
    queueType: entryLike.queueType,
    queueGroup: entryLike.queueGroup,
  };

  if (entryLike.queueType === 'airport') {
    filter.airportCode = entryLike.airportCode;
  }

  if (entryLike.queueType === 'event') {
    filter.eventCode = entryLike.eventCode;
  }

  return filter;
}

function sameScope(left, right) {
  return (
    left.queueType === right.queueType &&
    left.queueGroup === right.queueGroup &&
    String(left.airportCode || '') === String(right.airportCode || '') &&
    String(left.eventCode || '') === String(right.eventCode || '')
  );
}

function toQueueGroup(rideCategory) {
  return normalizeRideCategory(rideCategory);
}

function meetsPremiumQueueCompliance(driver, queueGroup = 'regular') {
  if (queueGroup !== 'black_car') {
    return true;
  }

  const complianceProfile = evaluateDriverChicagoRequirements(driver, {
    now: new Date(),
  });

  return complianceProfile.isCompliant;
}

async function ensureDriverEligible(driverId, queueGroup = 'regular') {
  const driver = await Driver.findOne({ _id: driverId, status: 'approved' }).select(
    '_id name phone email status operatingStates docs chauffeurLicense vehicleInspection'
  );
  if (!driver) {
    throw new Error('Approved driver not found for queue operations.');
  }

  const activeTrip = await Trip.findOne({
    driver: driver._id,
    status: { $in: ACTIVE_DRIVER_TRIP_STATUSES },
  }).select('_id');

  if (activeTrip) {
    throw new Error('Driver has an active trip and cannot join queue operations.');
  }

  if (!meetsPremiumQueueCompliance(driver, queueGroup)) {
    throw new Error('Driver does not meet Chicago premium document requirements for black service queue operations.');
  }

  return driver;
}

async function cleanupExpiredEventQueueEntries() {
  const now = new Date();

  await AirportQueueEntry.updateMany(
    {
      queueType: 'event',
      status: 'waiting',
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: 'exited',
        exitedAt: now,
        exitReason: 'Temporary event queue window expired.',
      },
    }
  );
}

async function computeQueuePosition(entry) {
  if (!entry || entry.status !== 'waiting') {
    return null;
  }

  const filter = {
    ...buildScopeFilter(entry),
    status: 'waiting',
    joinedAt: { $lt: entry.joinedAt },
  };

  if (entry.queueType === 'event') {
    filter.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];
  }

  const aheadCount = await AirportQueueEntry.countDocuments(filter);

  return aheadCount + 1;
}

async function buildQueueSnapshot(entry) {
  if (!entry) {
    return null;
  }

  const position = await computeQueuePosition(entry);
  const estimatedWaitMinutes =
    entry.status === 'waiting' && position !== null ? Math.max((position - 1) * DEFAULT_AVERAGE_ASSIGNMENT_MINUTES, 0) : null;

  return {
    id: String(entry._id),
    driverId: String(entry.driver),
    queueType: entry.queueType,
    queueGroup: entry.queueGroup,
    airportCode: entry.airportCode || null,
    eventCode: entry.eventCode || null,
    lotCode: entry.lotCode || null,
    stagingAreaCode: entry.stagingAreaCode || null,
    pickupZoneCode: entry.pickupZoneCode || null,
    status: entry.status,
    position,
    estimatedWaitMinutes,
    joinedAt: entry.joinedAt,
    assignedTrip: entry.assignedTrip ? String(entry.assignedTrip) : null,
    assignedAt: entry.assignedAt,
    exitedAt: entry.exitedAt,
    exitReason: entry.exitReason,
    expiresAt: entry.expiresAt,
    lastKnownLocation: entry.lastKnownLocation || null,
  };
}

async function getDriverWaitingQueueEntry(driverId) {
  return AirportQueueEntry.findOne({
    driver: driverId,
    status: 'waiting',
  }).sort({ joinedAt: -1 });
}

function resolveAirportScope({ point, airportCode, queueGroup }) {
  const normalizedAirportCode = airportCode ? String(airportCode).toUpperCase() : null;
  const detectedAirport = point ? getAirportByPoint(point) : null;
  const resolvedAirportCode = normalizedAirportCode || detectedAirport?.code || null;

  if (!resolvedAirportCode || !AIRPORT_GEOFENCES[resolvedAirportCode]) {
    throw new Error('Driver must be inside ORD or MDW geofence to join airport queue.');
  }

  const lotContext = point ? getAirportLotByPoint(point, queueGroup) : null;
  if (point && (!lotContext || lotContext.airportCode !== resolvedAirportCode)) {
    throw new Error('Driver must be inside airport boundary to join queue.');
  }

  if (point && lotContext && !lotContext.inSelectedLot) {
    throw new Error(`Driver must join the ${lotContext.requiredLot?.name || 'assigned'} lot for ${queueGroup} queue.`);
  }

  const pickupZone = point ? getAirportPickupZoneByPoint(point) : null;

  return {
    queueType: 'airport',
    airportCode: resolvedAirportCode,
    eventCode: null,
    queueGroup,
    lotCode: lotContext?.lotCode || null,
    stagingAreaCode: null,
    pickupZoneCode: pickupZone?.zone?.code || null,
    expiresAt: null,
  };
}

function resolveEventScope({ point, eventCode, queueGroup }) {
  const normalizedEventCode = eventCode ? String(eventCode).toUpperCase() : null;
  const detectedEvent = point ? getEventByPoint(point) : null;
  const resolvedEventCode = normalizedEventCode || detectedEvent?.code || null;

  if (!resolvedEventCode || !SUPPORTED_EVENT_CODES.includes(resolvedEventCode)) {
    throw new Error('Driver must be inside a supported event geofence to join temporary queue.');
  }

  if (!isEventQueueWindowOpen(resolvedEventCode)) {
    throw new Error('Temporary event queue is currently closed for this venue.');
  }

  const stagingContext = point ? getEventStagingAreaByPoint(point, queueGroup) : null;
  if (point && (!stagingContext || stagingContext.eventCode !== resolvedEventCode || !stagingContext.inStagingArea)) {
    throw new Error('Driver must be in designated event staging area to join temporary queue.');
  }

  const pickupLane = point ? getEventPickupLaneByPoint(point) : null;

  const expiresAt = new Date(Date.now() + EVENT_QUEUE_ENTRY_TTL_MINUTES * 60 * 1000);

  return {
    queueType: 'event',
    airportCode: null,
    eventCode: resolvedEventCode,
    queueGroup,
    lotCode: null,
    stagingAreaCode: stagingContext?.stagingAreaCode || null,
    pickupZoneCode: pickupLane?.lane?.code || null,
    expiresAt,
  };
}

function resolveQueueScope({ latitude, longitude, airportCode = null, eventCode = null, queueType = null, rideCategory = 'black_car' }) {
  const point = normalizeLocation({ latitude, longitude });
  const queueGroup = toQueueGroup(rideCategory);

  const requestedQueueType = String(queueType || '').toLowerCase();
  if (requestedQueueType === 'event' || eventCode) {
    return {
      scope: resolveEventScope({ point, eventCode, queueGroup }),
      point,
    };
  }

  if (requestedQueueType === 'airport' || airportCode || getAirportByPoint(point)) {
    return {
      scope: resolveAirportScope({ point, airportCode, queueGroup }),
      point,
    };
  }

  if (getEventByPoint(point)) {
    return {
      scope: resolveEventScope({ point, eventCode: null, queueGroup }),
      point,
    };
  }

  throw new Error('Driver is not inside supported airport or event operations geofence.');
}

async function enterAirportQueue({
  driverId,
  latitude,
  longitude,
  airportCode = null,
  eventCode = null,
  queueType = null,
  rideCategory = 'black_car',
}) {
  if (!driverId) {
    throw new Error('driverId is required.');
  }

  await cleanupExpiredEventQueueEntries();

  const { scope, point } = resolveQueueScope({
    latitude,
    longitude,
    airportCode,
    eventCode,
    queueType,
    rideCategory,
  });

  await ensureDriverEligible(driverId, scope.queueGroup);

  const existingWaitingEntry = await getDriverWaitingQueueEntry(driverId);
  if (existingWaitingEntry) {
    if (!sameScope(existingWaitingEntry, scope)) {
      existingWaitingEntry.status = 'exited';
      existingWaitingEntry.exitedAt = new Date();
      existingWaitingEntry.exitReason = 'Moved between operations queues.';
      await existingWaitingEntry.save();
    } else {
      if (point) {
        existingWaitingEntry.lastKnownLocation = point;
      }
      existingWaitingEntry.lotCode = scope.lotCode;
      existingWaitingEntry.stagingAreaCode = scope.stagingAreaCode;
      existingWaitingEntry.pickupZoneCode = scope.pickupZoneCode;
      existingWaitingEntry.expiresAt = scope.expiresAt;
      await existingWaitingEntry.save();

      return buildQueueSnapshot(existingWaitingEntry);
    }
  }

  const newEntry = await AirportQueueEntry.create({
    driver: driverId,
    queueType: scope.queueType,
    queueGroup: scope.queueGroup,
    airportCode: scope.airportCode,
    eventCode: scope.eventCode,
    lotCode: scope.lotCode,
    stagingAreaCode: scope.stagingAreaCode,
    pickupZoneCode: scope.pickupZoneCode,
    status: 'waiting',
    joinedAt: new Date(),
    expiresAt: scope.expiresAt,
    lastKnownLocation: point,
  });

  return buildQueueSnapshot(newEntry);
}

async function exitAirportQueue({
  driverId,
  airportCode = null,
  eventCode = null,
  queueType = null,
  reason = 'Driver exited queue.',
}) {
  if (!driverId) {
    throw new Error('driverId is required.');
  }

  await cleanupExpiredEventQueueEntries();

  const query = {
    driver: driverId,
    status: 'waiting',
  };

  if (queueType) {
    query.queueType = String(queueType).toLowerCase();
  }

  if (airportCode) {
    query.airportCode = String(airportCode).toUpperCase();
  }

  if (eventCode) {
    query.eventCode = String(eventCode).toUpperCase();
  }

  const entry = await AirportQueueEntry.findOne(query).sort({ joinedAt: -1 });
  if (!entry) {
    return null;
  }

  entry.status = 'exited';
  entry.exitedAt = new Date();
  entry.exitReason = reason;
  await entry.save();

  return buildQueueSnapshot(entry);
}

async function getDriverAirportQueueStatus({ driverId, latitude = null, longitude = null, rideCategory = 'black_car' }) {
  if (!driverId) {
    throw new Error('driverId is required.');
  }

  await cleanupExpiredEventQueueEntries();

  const point = normalizeLocation({ latitude, longitude });
  const queueGroup = toQueueGroup(rideCategory);

  const detectedAirport = point ? getAirportByPoint(point) : null;
  const detectedAirportLot = point ? getAirportLotByPoint(point, queueGroup) : null;
  const pickupZone = point ? getAirportPickupZoneByPoint(point) : null;

  const detectedEvent = point ? getEventByPoint(point) : null;
  const eventStagingArea = point ? getEventStagingAreaByPoint(point, queueGroup) : null;
  const eventPickupLane = point ? getEventPickupLaneByPoint(point) : null;

  const waitingEntry = await getDriverWaitingQueueEntry(driverId);

  if (waitingEntry && point) {
    waitingEntry.lastKnownLocation = point;
    waitingEntry.pickupZoneCode =
      waitingEntry.queueType === 'airport'
        ? pickupZone?.zone?.code || waitingEntry.pickupZoneCode
        : eventPickupLane?.lane?.code || waitingEntry.pickupZoneCode;

    if (waitingEntry.queueType === 'event') {
      waitingEntry.expiresAt = new Date(Date.now() + EVENT_QUEUE_ENTRY_TTL_MINUTES * 60 * 1000);
    }

    await waitingEntry.save();
  }

  const queueEntry = waitingEntry ? await buildQueueSnapshot(waitingEntry) : null;

  return {
    driverId,
    queueGroup,
    isInAirportLot: Boolean(detectedAirport),
    detectedAirport: detectedAirport
      ? {
          code: detectedAirport.code,
          name: detectedAirport.name,
        }
      : null,
    detectedAirportLot: detectedAirportLot
      ? {
          queueGroup,
          lotCode: detectedAirportLot.lotCode,
          lotName: detectedAirportLot.lotName,
          inRequiredLot: Boolean(detectedAirportLot.inSelectedLot),
        }
      : null,
    pickupZone: pickupZone
      ? {
          code: pickupZone.zone.code,
          name: pickupZone.zone.name,
          laneType: pickupZone.zone.laneType,
        }
      : null,
    isInEventVenue: Boolean(detectedEvent),
    detectedEvent: detectedEvent
      ? {
          code: detectedEvent.code,
          name: detectedEvent.name,
          queueOpen: Boolean(detectedEvent.queueOpen),
        }
      : null,
    eventStagingArea: eventStagingArea
      ? {
          queueGroup,
          code: eventStagingArea.stagingAreaCode,
          name: eventStagingArea.stagingAreaName,
          inRequiredStagingArea: Boolean(eventStagingArea.inStagingArea),
          queueOpen: Boolean(eventStagingArea.queueOpen),
        }
      : null,
    eventPickupLane: eventPickupLane
      ? {
          code: eventPickupLane.lane.code,
          name: eventPickupLane.lane.name,
          laneType: eventPickupLane.lane.laneType,
        }
      : null,
    queueEntry,
    enforcement: {
      airportQueueStrict: AIRPORT_QUEUE_STRICT,
      eventQueueStrict: EVENT_QUEUE_STRICT,
    },
  };
}

async function assignDriverFromOperationsQueue({
  queueType = 'airport',
  airportCode = null,
  eventCode = null,
  queueGroup = 'regular',
  excludedDriverIds = [],
  tripId = null,
  isDriverEligible = null,
}) {
  await cleanupExpiredEventQueueEntries();

  const normalizedQueueType = String(queueType || 'airport').toLowerCase();
  const normalizedQueueGroup = toQueueGroup(queueGroup);

  const query = {
    queueType: normalizedQueueType,
    queueGroup: normalizedQueueGroup,
    status: 'waiting',
  };

  if (normalizedQueueType === 'airport') {
    if (!airportCode) {
      return null;
    }

    query.airportCode = String(airportCode).toUpperCase();
  }

  if (normalizedQueueType === 'event') {
    if (!eventCode) {
      return null;
    }

    query.eventCode = String(eventCode).toUpperCase();
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];
  }

  const excludedSet = new Set(excludedDriverIds.map(id => String(id)));

  const queueEntries = await AirportQueueEntry.find(query)
    .populate('driver', '_id name phone email status tripPreferences operatingStates docs chauffeurLicense vehicleInspection')
    .sort({ joinedAt: 1 })
    .limit(200);

  for (const entry of queueEntries) {
    if (!entry.driver || String(entry.driver.status) !== 'approved') {
      entry.status = 'exited';
      entry.exitedAt = new Date();
      entry.exitReason = 'Removed from queue: driver unavailable.';
      await entry.save();
      continue;
    }

    const driverId = String(entry.driver._id);
    if (excludedSet.has(driverId)) {
      continue;
    }

    if (typeof isDriverEligible === 'function') {
      let isEligible = false;
      try {
        isEligible = Boolean(await isDriverEligible(entry.driver, entry));
      } catch (_error) {
        isEligible = false;
      }

      if (!isEligible) {
        continue;
      }
    }

    if (!meetsPremiumQueueCompliance(entry.driver, normalizedQueueGroup)) {
      continue;
    }

    const activeTrip = await Trip.findOne({
      driver: entry.driver._id,
      status: { $in: ACTIVE_DRIVER_TRIP_STATUSES },
    }).select('_id');

    if (activeTrip) {
      entry.status = 'exited';
      entry.exitedAt = new Date();
      entry.exitReason = 'Removed from queue: active trip in progress.';
      await entry.save();
      continue;
    }

    const position = await computeQueuePosition(entry);
    entry.status = 'assigned';
    entry.assignedAt = new Date();
    entry.assignedTrip = tripId || null;
    entry.exitReason = null;
    await entry.save();

    return {
      driver: entry.driver,
      queueEntryId: String(entry._id),
      queueType: entry.queueType,
      queueGroup: entry.queueGroup,
      airportCode: entry.airportCode || null,
      eventCode: entry.eventCode || null,
      queuePosition: position,
      lotCode: entry.lotCode || null,
      stagingAreaCode: entry.stagingAreaCode || null,
      pickupZoneCode: entry.pickupZoneCode || null,
    };
  }

  return null;
}

async function assignDriverFromAirportQueue({ airportCode, queueGroup = 'regular', excludedDriverIds = [], tripId = null }) {
  return assignDriverFromOperationsQueue({
    queueType: 'airport',
    airportCode,
    queueGroup,
    excludedDriverIds,
    tripId,
  });
}

async function exitAssignedQueueEntry({ queueEntryId, reason = 'Queue assignment released.' }) {
  if (!queueEntryId) {
    return null;
  }

  const entry = await AirportQueueEntry.findById(queueEntryId);
  if (!entry) {
    return null;
  }

  if (entry.status === 'exited') {
    return buildQueueSnapshot(entry);
  }

  entry.status = 'exited';
  entry.exitedAt = new Date();
  entry.exitReason = reason;
  await entry.save();

  return buildQueueSnapshot(entry);
}

module.exports = {
  AIRPORT_QUEUE_STRICT,
  EVENT_QUEUE_STRICT,
  ACTIVE_DRIVER_TRIP_STATUSES,
  enterAirportQueue,
  exitAirportQueue,
  getDriverAirportQueueStatus,
  assignDriverFromOperationsQueue,
  assignDriverFromAirportQueue,
  exitAssignedQueueEntry,
};
