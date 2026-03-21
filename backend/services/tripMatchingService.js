const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const { queryNearbyDrivers } = require('./activeDriversStore');
const { getOperationsContextByPoint } = require('./airportGeofenceService');
const { assignDriverFromOperationsQueue } = require('./airportQueueService');
const { normalizeRideCategory, isPremiumRideCategory } = require('./configService');
const { evaluateDriverChicagoRequirements } = require('./complianceReportingService');

const ACTIVE_DRIVER_TRIP_STATUSES = ['driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'];
const DEFAULT_MATCH_RADIUS_KM = Number(process.env.TRIP_MATCH_RADIUS_KM || 5);
const DEFAULT_MATCH_LIMIT = Number(process.env.TRIP_MATCH_LIMIT || 25);
const AIRPORT_QUEUE_STRICT = String(process.env.AIRPORT_QUEUE_STRICT || 'true').toLowerCase() !== 'false';
const EVENT_QUEUE_STRICT = String(process.env.EVENT_QUEUE_STRICT || 'false').toLowerCase() === 'true';

function toQueueGroup(rideCategory) {
  const normalizedRideCategory = normalizeRideCategory(rideCategory) || 'rydinex_comfort';
  return isPremiumRideCategory(normalizedRideCategory) ? 'black_car' : 'regular';
}

function driverSupportsTripRequirements(driver, requirements = {}) {
  if (!driver) {
    return false;
  }

  const serviceDogRequested = Boolean(requirements.serviceDogRequested);
  const teenPickup = Boolean(requirements.teenPickup);
  const preferences = driver.tripPreferences || {};

  if (serviceDogRequested && preferences.serviceDogEnabled === false) {
    return false;
  }

  if (teenPickup && preferences.teenPickupEnabled !== true) {
    return false;
  }

  return true;
}

function driverMeetsPremiumServiceCompliance(driver, rideCategory) {
  if (!isPremiumRideCategory(rideCategory)) {
    return true;
  }

  const complianceProfile = evaluateDriverChicagoRequirements(driver, {
    now: new Date(),
  });

  return complianceProfile.isCompliant;
}

async function findAvailableNearbyDriver({
  pickup,
  excludedDriverIds = [],
  tripId = null,
  rideCategory = 'black_car',
  serviceDogRequested = false,
  teenPickup = false,
}) {
  const queueGroup = toQueueGroup(rideCategory);
  const operationsContext = getOperationsContextByPoint(pickup, {
    rideCategory,
  });
  const tripRequirements = {
    serviceDogRequested,
    teenPickup,
  };
  const excludedSet = new Set(excludedDriverIds.map(id => String(id)));

  if (operationsContext.operationType === 'airport') {
    const queueMatch = await assignDriverFromOperationsQueue({
      queueType: 'airport',
      airportCode: operationsContext.airportCode,
      queueGroup,
      excludedDriverIds,
      tripId,
      isDriverEligible: candidateDriver =>
        driverSupportsTripRequirements(candidateDriver, tripRequirements) &&
        driverMeetsPremiumServiceCompliance(candidateDriver, rideCategory),
    });

    if (queueMatch) {
      return {
        driver: queueMatch.driver,
        distanceKm: null,
        assignmentSource: 'airport_queue',
        queueType: 'airport',
        queueGroup: queueMatch.queueGroup,
        queueEntryId: queueMatch.queueEntryId,
        queueAirportCode: queueMatch.airportCode,
        queueEventCode: null,
        queuePosition: queueMatch.queuePosition,
        pickupZoneCode: queueMatch.pickupZoneCode,
      };
    }

    if (AIRPORT_QUEUE_STRICT) {
      return null;
    }
  }

  if (operationsContext.operationType === 'event' && operationsContext.queueOpen) {
    const queueMatch = await assignDriverFromOperationsQueue({
      queueType: 'event',
      eventCode: operationsContext.eventCode,
      queueGroup,
      excludedDriverIds,
      tripId,
      isDriverEligible: candidateDriver =>
        driverSupportsTripRequirements(candidateDriver, tripRequirements) &&
        driverMeetsPremiumServiceCompliance(candidateDriver, rideCategory),
    });

    if (queueMatch) {
      return {
        driver: queueMatch.driver,
        distanceKm: null,
        assignmentSource: 'event_queue',
        queueType: 'event',
        queueGroup: queueMatch.queueGroup,
        queueEntryId: queueMatch.queueEntryId,
        queueAirportCode: null,
        queueEventCode: queueMatch.eventCode,
        queuePosition: queueMatch.queuePosition,
        stagingAreaCode: queueMatch.stagingAreaCode,
        pickupZoneCode: queueMatch.pickupZoneCode,
      };
    }

    if (EVENT_QUEUE_STRICT) {
      return null;
    }
  }

  const nearbyCandidates = await queryNearbyDrivers({
    latitude: pickup.latitude,
    longitude: pickup.longitude,
    radiusKm: DEFAULT_MATCH_RADIUS_KM,
    limit: DEFAULT_MATCH_LIMIT,
  });

  if (!nearbyCandidates.length) {
    return null;
  }

  for (const candidate of nearbyCandidates) {
    const candidateDriverId = String(candidate.driverId);
    if (excludedSet.has(candidateDriverId)) {
      continue;
    }

    const driver = await Driver.findOne({
      _id: candidateDriverId,
      status: 'approved',
    }).select('_id name phone email tripPreferences operatingStates docs chauffeurLicense vehicleInspection');

    if (!driver) {
      continue;
    }

    if (!driverSupportsTripRequirements(driver, tripRequirements)) {
      continue;
    }

    if (!driverMeetsPremiumServiceCompliance(driver, rideCategory)) {
      continue;
    }

    const activeTripForDriver = await Trip.findOne({
      driver: driver._id,
      status: { $in: ACTIVE_DRIVER_TRIP_STATUSES },
    }).select('_id');

    if (activeTripForDriver) {
      continue;
    }

    return {
      driver,
      distanceKm: candidate.distanceKm || null,
      assignmentSource:
        operationsContext.operationType === 'airport'
          ? 'nearby_fallback_airport'
          : operationsContext.operationType === 'event'
          ? 'nearby_fallback_event'
          : 'nearby',
      queueType: operationsContext.operationType === 'city' ? null : operationsContext.operationType,
      queueGroup: operationsContext.operationType === 'city' ? null : queueGroup,
      queueEntryId: null,
      queueAirportCode: operationsContext.operationType === 'airport' ? operationsContext.airportCode : null,
      queueEventCode: operationsContext.operationType === 'event' ? operationsContext.eventCode : null,
      queuePosition: null,
    };
  }

  return null;
}

module.exports = {
  ACTIVE_DRIVER_TRIP_STATUSES,
  findAvailableNearbyDriver,
};
