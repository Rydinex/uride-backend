const TripLog = require('../models/TripLog');
const DriverLog = require('../models/DriverLog');
const SafetyLog = require('../models/SafetyLog');

function normalizeObjectId(value) {
  return value ? value : null;
}

function toDate(value) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

async function createTripLog(payload = {}) {
  const log = await TripLog.create({
    trip: normalizeObjectId(payload.trip),
    rider: normalizeObjectId(payload.rider),
    driver: normalizeObjectId(payload.driver),
    eventType: payload.eventType || 'trip_event',
    actorType: payload.actorType || 'system',
    actorId: payload.actorId || null,
    statusFrom: payload.statusFrom || null,
    statusTo: payload.statusTo || null,
    severity: payload.severity || 'info',
    metadata: payload.metadata || {},
    occurredAt: toDate(payload.occurredAt),
  });

  return log;
}

async function createDriverLog(payload = {}) {
  const log = await DriverLog.create({
    driver: normalizeObjectId(payload.driver),
    trip: normalizeObjectId(payload.trip),
    eventType: payload.eventType || 'driver_event',
    actorType: payload.actorType || 'system',
    actorId: payload.actorId || null,
    severity: payload.severity || 'info',
    metadata: payload.metadata || {},
    occurredAt: toDate(payload.occurredAt),
  });

  return log;
}

async function createSafetyLog(payload = {}) {
  const safetyLog = await SafetyLog.create({
    incidentType: payload.incidentType || 'general_incident',
    severity: payload.severity || 'medium',
    status: payload.status || 'open',
    trip: normalizeObjectId(payload.trip),
    rider: normalizeObjectId(payload.rider),
    driver: normalizeObjectId(payload.driver),
    reportedByType: payload.reportedByType || 'system',
    reportedById: payload.reportedById || null,
    title: payload.title || 'Safety incident',
    description: payload.description || 'Safety incident reported.',
    location: payload.location || {},
    metadata: payload.metadata || {},
    occurredAt: toDate(payload.occurredAt),
  });

  return safetyLog;
}

async function logTripStatusTransition({ trip, eventType, actorType = 'system', actorId = null, statusFrom = null, statusTo = null, severity = 'info', metadata = {} }) {
  if (!trip || !trip._id) {
    return null;
  }

  const logPayload = {
    trip: trip._id,
    rider: trip.rider || null,
    driver: trip.driver || null,
    eventType: eventType || 'trip_status_transition',
    actorType,
    actorId,
    statusFrom,
    statusTo,
    severity,
    metadata,
  };

  const tripLogPromise = createTripLog(logPayload);

  const driverLogPromise = trip.driver
    ? createDriverLog({
        driver: trip.driver,
        trip: trip._id,
        eventType: eventType || 'trip_status_transition',
        actorType: actorType === 'rider' ? 'system' : actorType,
        actorId,
        severity,
        metadata,
      })
    : Promise.resolve(null);

  await Promise.all([tripLogPromise, driverLogPromise]);

  return true;
}

module.exports = {
  createTripLog,
  createDriverLog,
  createSafetyLog,
  logTripStatusTransition,
};
