const Rider = require('../models/Rider');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const { ACTIVE_DRIVER_TRIP_STATUSES, findAvailableNearbyDriver } = require('../services/tripMatchingService');
const { calculateUpfrontPricing, calculatePayoutFromFare, calculateTripFareFromMetrics } = require('../services/pricingService');
const { exitAssignedQueueEntry } = require('../services/airportQueueService');
const { createSafetyLog, logTripStatusTransition } = require('../services/complianceLogService');
const { evaluateTripStatePolicy } = require('../services/tripStatePolicyService');

const DRIVER_RESPONSE_WINDOW_SECONDS = Number(process.env.DRIVER_RESPONSE_WINDOW_SECONDS || 25);
const ALLOWED_STATUS_UPDATES = [
  'driver_arrived_pickup',
  'in_progress',
  'completed',
  'cancelled',
];
const BOOKING_TYPES = ['on_demand', 'reservation', 'hourly'];
const SCHEDULED_ASSIGNMENT_WINDOW_MINUTES = Number(process.env.SCHEDULED_ASSIGNMENT_WINDOW_MINUTES || 30);
const TIP_UPDATE_WINDOW_HOURS = -1;

function normalizeBookingType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return BOOKING_TYPES.includes(normalized) ? normalized : 'on_demand';
}

function parseScheduledAt(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldDeferScheduledDispatch({ bookingType, scheduledAt }) {
  if (!scheduledAt) {
    return false;
  }

  const normalizedBookingType = normalizeBookingType(bookingType);
  if (!['reservation', 'hourly'].includes(normalizedBookingType)) {
    return false;
  }

  const dispatchWindowMs = Math.max(SCHEDULED_ASSIGNMENT_WINDOW_MINUTES, 1) * 60 * 1000;
  return scheduledAt.getTime() - Date.now() > dispatchWindowMs;
}

function normalizeTripPoint(point, fieldName) {
  if (!point || typeof point !== 'object') {
    throw new Error(`${fieldName} is required.`);
  }

  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`${fieldName}.latitude and ${fieldName}.longitude must be valid numbers.`);
  }

  const state = point.state ? String(point.state).trim().toUpperCase() : '';
  if (state && !/^[A-Z]{2}$/.test(state)) {
    throw new Error(`${fieldName}.state must be a valid 2-letter state code.`);
  }

  const country = point.country ? String(point.country).trim().toUpperCase() : '';
  if (country && !/^[A-Z]{2}$/.test(country)) {
    throw new Error(`${fieldName}.country must be a valid 2-letter country code.`);
  }

  const city = point.city ? String(point.city).trim() : '';
  if (city.length > 120) {
    throw new Error(`${fieldName}.city must be at most 120 characters.`);
  }

  return {
    latitude,
    longitude,
    address: point.address || '',
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
  };
}

function appendTripStatus(trip, { status, actorType = 'system', actorId = null, note = '' }) {
  trip.statusHistory.push({
    status,
    actorType,
    actorId,
    note,
    at: new Date(),
  });
}

function toFiniteNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function haversineDistanceKm(pointA, pointB) {
  const earthRadiusKm = 6371;
  const latitudeDeltaRadians = (pointB.latitude - pointA.latitude) * (Math.PI / 180);
  const longitudeDeltaRadians = (pointB.longitude - pointA.longitude) * (Math.PI / 180);

  const originLatitudeRadians = pointA.latitude * (Math.PI / 180);
  const destinationLatitudeRadians = pointB.latitude * (Math.PI / 180);

  const a =
    Math.sin(latitudeDeltaRadians / 2) * Math.sin(latitudeDeltaRadians / 2) +
    Math.sin(longitudeDeltaRadians / 2) * Math.sin(longitudeDeltaRadians / 2) *
      Math.cos(originLatitudeRadians) *
      Math.cos(destinationLatitudeRadians);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function kmToMiles(distanceKm) {
  return distanceKm * 0.621371;
}

function toMoney(value) {
  return Number((Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function resolveTripTipPolicy(trip, referenceDate = new Date()) {
  const reference = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const completedAtValue = trip?.completedAt || trip?.endedAt || null;
  const completedAt = completedAtValue ? new Date(completedAtValue) : null;
  const isUnlimitedTipWindow = TIP_UPDATE_WINDOW_HOURS < 0;

  if (!completedAt || Number.isNaN(completedAt.getTime())) {
    return {
      tipUpdateWindowHours: TIP_UPDATE_WINDOW_HOURS,
      isUnlimitedTipWindow,
      isTipEditable: true,
      tipUpdateLocked: false,
      completedAt: completedAtValue ? new Date(completedAtValue).toISOString() : null,
      tipEditableUntil: null,
      minutesRemaining: null,
    };
  }

  if (isUnlimitedTipWindow) {
    return {
      tipUpdateWindowHours: TIP_UPDATE_WINDOW_HOURS,
      isUnlimitedTipWindow,
      isTipEditable: true,
      tipUpdateLocked: false,
      completedAt: completedAt.toISOString(),
      tipEditableUntil: null,
      minutesRemaining: null,
    };
  }

  const tipWindowMs = Math.max(TIP_UPDATE_WINDOW_HOURS, 0) * 60 * 60 * 1000;
  const tipEditableUntilDate = new Date(completedAt.getTime() + tipWindowMs);
  const isTipEditable = reference.getTime() <= tipEditableUntilDate.getTime();
  const minutesRemaining = Math.max((tipEditableUntilDate.getTime() - reference.getTime()) / 60000, 0);

  return {
    tipUpdateWindowHours: TIP_UPDATE_WINDOW_HOURS,
    isUnlimitedTipWindow,
    isTipEditable,
    tipUpdateLocked: !isTipEditable,
    completedAt: completedAt.toISOString(),
    tipEditableUntil: tipEditableUntilDate.toISOString(),
    minutesRemaining: Number(minutesRemaining.toFixed(2)),
  };
}

function normalizeRatingValue(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }

  return parsed;
}

function buildRiderFeedbackSummary(trip) {
  return {
    overallRating: normalizeRatingValue(trip?.riderOverallRating),
    driverProfessionalismRating: normalizeRatingValue(trip?.riderProfessionalismRating),
    carCleanlinessRating: normalizeRatingValue(trip?.riderCarCleanlinessRating),
    amenitiesRating: normalizeRatingValue(trip?.riderAmenitiesRating),
    greetingRating: normalizeRatingValue(trip?.riderGreetingRating),
    comments: String(trip?.riderFeedbackComment || '').trim(),
    submittedAt: trip?.riderFeedbackSubmittedAt || null,
    updatedAt: trip?.riderFeedbackUpdatedAt || null,
  };
}

function buildDriverRiderFeedbackSummary(trip) {
  return {
    overallRating: normalizeRatingValue(trip?.driverRiderOverallRating),
    safetyRating: normalizeRatingValue(trip?.driverRiderSafetyRating),
    respectRating: normalizeRatingValue(trip?.driverRiderRespectRating),
    comments: String(trip?.driverRiderFeedbackComment || '').trim(),
    submittedAt: trip?.driverRiderFeedbackSubmittedAt || null,
    updatedAt: trip?.driverRiderFeedbackUpdatedAt || null,
  };
}

function hasRiderFeedback(feedbackSummary) {
  if (!feedbackSummary || typeof feedbackSummary !== 'object') {
    return false;
  }

  return Boolean(
    feedbackSummary.overallRating ||
      feedbackSummary.driverProfessionalismRating ||
      feedbackSummary.carCleanlinessRating ||
      feedbackSummary.amenitiesRating ||
      feedbackSummary.greetingRating ||
      feedbackSummary.comments
  );
}

function hasDriverRiderFeedback(feedbackSummary) {
  if (!feedbackSummary || typeof feedbackSummary !== 'object') {
    return false;
  }

  return Boolean(feedbackSummary.overallRating || feedbackSummary.safetyRating || feedbackSummary.respectRating || feedbackSummary.comments);
}

function buildTipPresetOptions(baseFare) {
  const safeBaseFare = Math.max(Number(baseFare) || 0, 0);
  return [10, 15, 20, 25].map(percent => ({
    percent,
    amount: toMoney((safeBaseFare * percent) / 100),
  }));
}

function normalizeRoutePoint(point) {
  if (!point || typeof point !== 'object') {
    throw new Error('Route point payload is required.');
  }

  const latitude = toFiniteNumber(point.latitude);
  const longitude = toFiniteNumber(point.longitude);

  if (latitude === null || longitude === null) {
    throw new Error('latitude and longitude are required for route tracking.');
  }

  return {
    latitude,
    longitude,
    speedKph: toFiniteNumber(point.speedKph),
    heading: toFiniteNumber(point.heading),
    accuracyMeters: toFiniteNumber(point.accuracyMeters),
    recordedAt: point.recordedAt ? new Date(point.recordedAt) : new Date(),
  };
}

function appendRoutePoint(trip, routePoint) {
  const previousPoint =
    trip.routePoints && trip.routePoints.length > 0
      ? trip.routePoints[trip.routePoints.length - 1]
      : trip.currentDriverLocation || null;

  if (previousPoint && Number.isFinite(previousPoint.latitude) && Number.isFinite(previousPoint.longitude)) {
    const segmentDistanceKm = haversineDistanceKm(
      {
        latitude: Number(previousPoint.latitude),
        longitude: Number(previousPoint.longitude),
      },
      {
        latitude: routePoint.latitude,
        longitude: routePoint.longitude,
      }
    );

    if (Number.isFinite(segmentDistanceKm)) {
      trip.actualDistanceKm = Number((Number(trip.actualDistanceKm || 0) + segmentDistanceKm).toFixed(4));
      trip.actualDistanceMiles = Number(kmToMiles(trip.actualDistanceKm).toFixed(4));
    }
  }

  trip.currentDriverLocation = routePoint;
  trip.routePoints.push(routePoint);
}

function buildTripSummary(trip, referenceDate = new Date()) {
  const startedAt = trip.startedAt || trip.acceptedAt || trip.createdAt;
  const endedAt = trip.endedAt || trip.completedAt || null;

  const durationMinutes =
    trip.actualDurationMinutes && trip.actualDurationMinutes > 0
      ? trip.actualDurationMinutes
      : startedAt && endedAt
      ? Math.max((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000, 0)
      : 0;

  const distanceMiles = trip.actualDistanceMiles || trip.distanceMilesEstimate || 0;
  const distanceKm = trip.actualDistanceKm || trip.distanceKmEstimate || 0;

  const finalFare = toMoney(trip.fareEstimate || trip.upfrontFare || 0);
  const tipAmount = toMoney(trip.tipAmount || 0);
  const totalCharged = toMoney(finalFare + tipAmount);
  const platformCommission = toMoney(trip.platformCommission || 0);
  const driverEarnings = toMoney(trip.driverEarnings || finalFare - platformCommission);
  const driverTotalEarnings = toMoney(driverEarnings + tipAmount);
  const tipPolicy = resolveTripTipPolicy(trip, referenceDate);
  const riderFeedback = buildRiderFeedbackSummary(trip);
  const driverRiderFeedback = buildDriverRiderFeedbackSummary(trip);
  const feedbackPending = !hasRiderFeedback(riderFeedback);
  const tipPresetOptions = buildTipPresetOptions(finalFare);

  return {
    tripId: String(trip._id),
    status: trip.status,
    rideCategory: trip.rideCategory || 'rydinex_regular',
    bookingType: normalizeBookingType(trip.bookingType),
    scheduledAt: trip.scheduledAt || null,
    estimatedHours: trip.estimatedHours || null,
    reservationFee: toMoney(trip.reservationFee || 0),
    serviceDogRequested: Boolean(trip.serviceDogRequested),
    serviceDogFee: toMoney(trip.serviceDogFee || 0),
    teenPickup: Boolean(trip.teenPickup),
    teenSeatingPolicy: trip.teenSeatingPolicy || (trip.teenPickup ? 'back_seat_only' : 'none'),
    specialInstructions:
      trip.specialInstructions || (trip.teenPickup ? 'Teen rider must sit in the back seat.' : ''),
    hourlyRate: trip.hourlyRate !== null && trip.hourlyRate !== undefined ? toMoney(trip.hourlyRate) : null,
    hourlySubtotal: trip.hourlySubtotal !== null && trip.hourlySubtotal !== undefined ? toMoney(trip.hourlySubtotal) : null,
    currency: trip.currency || 'USD',
    startedAt,
    endedAt,
    pickup: trip.pickup,
    dropoff: trip.dropoff,
    pickupCountry: trip.pickupCountry || trip.pickup?.country || null,
    dropoffCountry: trip.dropoffCountry || trip.dropoff?.country || null,
    pickupState: trip.pickupState || trip.pickup?.state || null,
    dropoffState: trip.dropoffState || trip.dropoff?.state || null,
    pickupCity: trip.pickupCity || trip.pickup?.city || null,
    dropoffCity: trip.dropoffCity || trip.dropoff?.city || null,
    isPrearranged: Boolean(trip.isPrearranged),
    statePolicyVersion: trip.statePolicyVersion || null,
    distanceKm: Number(Number(distanceKm).toFixed(3)),
    distanceMiles: Number(Number(distanceMiles).toFixed(3)),
    durationMinutes: Number(Number(durationMinutes).toFixed(2)),
    surgeMultiplier: Number(Number(trip.surgeMultiplier || 1).toFixed(2)),
    airportFee: toMoney(trip.airportFee || 0),
    airportPickupCode: trip.airportPickupCode || null,
    airportDropoffCode: trip.airportDropoffCode || null,
    upfrontFare: toMoney(trip.upfrontFare || 0),
    finalFare,
    tipAmount,
    tipUpdatedAt: trip.tipUpdatedAt || null,
    totalCharged,
    platformCommission,
    platformCommissionRate: Number(Number(trip.platformCommissionRate || 0).toFixed(4)),
    driverEarnings,
    driverTotalEarnings,
    tipPolicy,
    riderFeedback,
    hasRiderFeedback: hasRiderFeedback(riderFeedback),
    driverRiderFeedback,
    hasDriverRiderFeedback: hasDriverRiderFeedback(driverRiderFeedback),
    feedbackPending,
    tipPresetOptions,
    routePointCount: Array.isArray(trip.routePoints) ? trip.routePoints.length : 0,
    rider: trip.rider
      ? {
          id: String(trip.rider._id || trip.rider),
          name: trip.rider.name || '',
          phone: trip.rider.phone || '',
          email: trip.rider.email || '',
        }
      : null,
    driver: trip.driver
      ? {
          id: String(trip.driver._id || trip.driver),
          name: trip.driver.name || '',
          phone: trip.driver.phone || '',
          email: trip.driver.email || '',
        }
      : null,
  };
}

function buildTripReceipt(trip, { referenceDate = new Date() } = {}) {
  const summary = buildTripSummary(trip, referenceDate);

  const receiptId = trip.receipt?.receiptId || `rcpt_${String(trip._id).slice(-10)}_${Date.now()}`;
  const generatedAt = trip.receipt?.generatedAt || new Date();

  return {
    receiptId,
    tripId: summary.tripId,
    generatedAt,
    currency: summary.currency,
    rider: summary.rider,
    driver: summary.driver,
    trip: {
      status: summary.status,
      rideCategory: summary.rideCategory,
      bookingType: summary.bookingType,
      scheduledAt: summary.scheduledAt,
      estimatedHours: summary.estimatedHours,
      serviceDogRequested: summary.serviceDogRequested,
      teenPickup: summary.teenPickup,
      teenSeatingPolicy: summary.teenSeatingPolicy,
      specialInstructions: summary.specialInstructions,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      pickup: summary.pickup,
      dropoff: summary.dropoff,
      pickupCountry: summary.pickupCountry,
      dropoffCountry: summary.dropoffCountry,
      pickupState: summary.pickupState,
      dropoffState: summary.dropoffState,
      pickupCity: summary.pickupCity,
      dropoffCity: summary.dropoffCity,
      isPrearranged: summary.isPrearranged,
      distanceKm: summary.distanceKm,
      distanceMiles: summary.distanceMiles,
      durationMinutes: summary.durationMinutes,
      routePointCount: summary.routePointCount,
    },
    fare: {
      surgeMultiplier: summary.surgeMultiplier,
      airportFee: summary.airportFee,
      reservationFee: summary.reservationFee,
      serviceDogFee: summary.serviceDogFee,
      hourlyRate: summary.hourlyRate,
      hourlySubtotal: summary.hourlySubtotal,
      upfrontFare: summary.upfrontFare,
      finalFare: summary.finalFare,
      tipAmount: summary.tipAmount,
      tipUpdatedAt: summary.tipUpdatedAt,
      totalCharged: summary.totalCharged,
      platformCommission: summary.platformCommission,
      platformCommissionRate: summary.platformCommissionRate,
      driverEarnings: summary.driverEarnings,
      driverTotalEarnings: summary.driverTotalEarnings,
    },
    tipPolicy: summary.tipPolicy,
    feedback: summary.riderFeedback,
    feedbackPending: summary.feedbackPending,
    tipPresetOptions: summary.tipPresetOptions,
    lineItems: [
      {
        label: summary.bookingType === 'hourly' ? 'Hourly service fare' : 'Base + distance + time fare',
        amount: toMoney(summary.finalFare - summary.airportFee - summary.reservationFee - summary.serviceDogFee),
      },
      ...(summary.reservationFee > 0
        ? [
            {
              label: 'Reservation fee',
              amount: summary.reservationFee,
            },
          ]
        : []),
      ...(summary.serviceDogFee > 0
        ? [
            {
              label: 'Service dog accommodation fee',
              amount: summary.serviceDogFee,
            },
          ]
        : []),
      ...(summary.airportFee > 0
        ? [
            {
              label: 'Airport fee',
              amount: summary.airportFee,
            },
          ]
        : []),
      ...(summary.tipAmount > 0
        ? [
            {
              label: 'Tip',
              amount: summary.tipAmount,
            },
          ]
        : []),
      {
        label: `Platform commission (${(summary.platformCommissionRate * 100).toFixed(1)}%)`,
        amount: summary.platformCommission,
      },
      {
        label: 'Driver earnings (incl. tip)',
        amount: summary.driverTotalEarnings,
      },
    ],
  };
}

function buildTripStatePolicyPayload(policyResult) {
  if (!policyResult || typeof policyResult !== 'object') {
    return null;
  }

  return {
    isAllowed: Boolean(policyResult.isAllowed),
    policyVersion: policyResult.policyVersion || null,
    policySource: policyResult.policySource || null,
    rideCategory: policyResult.rideCategory || null,
    isPrearranged: Boolean(policyResult.isPrearranged),
    pickupCountryCode: policyResult.pickupCountryCode || null,
    dropoffCountryCode: policyResult.dropoffCountryCode || null,
    pickupCountrySource: policyResult.pickupCountrySource || null,
    dropoffCountrySource: policyResult.dropoffCountrySource || null,
    pickupStateCode: policyResult.pickupStateCode || null,
    dropoffStateCode: policyResult.dropoffStateCode || null,
    pickupStateSource: policyResult.pickupStateSource || null,
    dropoffStateSource: policyResult.dropoffStateSource || null,
    pickupCity: policyResult.pickupCity || null,
    dropoffCity: policyResult.dropoffCity || null,
    pickupCitySource: policyResult.pickupCitySource || null,
    dropoffCitySource: policyResult.dropoffCitySource || null,
    violations: Array.isArray(policyResult.violations) ? policyResult.violations : [],
  };
}

function buildTripStatePolicyErrorResponse(policyResult, fallbackMessage) {
  const payload = buildTripStatePolicyPayload(policyResult);
  const primaryViolationMessage = payload?.violations?.[0]?.message || null;

  return {
    message: primaryViolationMessage || fallbackMessage || 'Trip is not allowed by current state policy.',
    statePolicy: payload,
  };
}

function emitIncomingTripToDriver(io, driverId, trip) {
  if (!io || !driverId || !trip) {
    return;
  }

  io.to(`driver:${driverId}`).emit('trip:incoming', {
    tripId: String(trip._id),
    assignedAt: new Date().toISOString(),
    trip,
  });
}

async function getUpfrontPricingQuote(req, res) {
  try {
    const {
      pickup,
      dropoff,
      surgeRadiusKm,
      rideCategory = 'rydinex_regular',
      bookingType = 'on_demand',
      scheduledAt = null,
      estimatedHours = null,
      serviceDogRequested = false,
      teenPickup = false,
      teenSeatingPolicy = 'none',
      specialInstructions = '',
      isPrearranged = false,
    } = req.body;

    const normalizedBookingType = normalizeBookingType(bookingType);
    const normalizedScheduledAt = parseScheduledAt(scheduledAt);
    const resolvedIsPrearranged = Boolean(isPrearranged || normalizedBookingType !== 'on_demand' || normalizedScheduledAt);

    const statePolicy = evaluateTripStatePolicy({
      pickup,
      dropoff,
      rideCategory,
      isPrearranged: resolvedIsPrearranged,
    });

    if (!statePolicy.isAllowed) {
      return res.status(422).json(
        buildTripStatePolicyErrorResponse(
          statePolicy,
          'Upfront pricing is unavailable for the selected trip state combination.'
        )
      );
    }

    const pricing = await calculateUpfrontPricing({
      pickup,
      dropoff,
      surgeRadiusKm,
      rideCategory,
      bookingType: normalizedBookingType,
      scheduledAt: normalizedScheduledAt,
      estimatedHours,
      serviceDogRequested,
    });

    return res.status(200).json({
      ...pricing,
      teenPickup: Boolean(teenPickup),
      teenSeatingPolicy: teenPickup ? 'back_seat_only' : teenSeatingPolicy || 'none',
      specialInstructions: specialInstructions || (teenPickup ? 'Teen rider must sit in the back seat.' : ''),
      statePolicy: buildTripStatePolicyPayload(statePolicy),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to calculate upfront pricing.' });
  }
}

async function assignDriverToTrip(trip, excludedDriverIds = []) {
  const previousStatus = trip.status;
  const match = await findAvailableNearbyDriver({
    pickup: trip.pickup,
    excludedDriverIds,
    tripId: trip._id,
    rideCategory: trip.rideCategory || 'rydinex_regular',
    serviceDogRequested: Boolean(trip.serviceDogRequested),
    teenPickup: Boolean(trip.teenPickup),
  });

  if (!match) {
    trip.driver = null;
    trip.status = 'no_driver';
    trip.driverResponseDeadlineAt = null;
    trip.assignedFromAirportQueue = false;
    trip.queueType = null;
    trip.queueGroup = null;
    trip.queueAirportCode = null;
    trip.queueEventCode = null;
    trip.queueEntryId = null;
    appendTripStatus(trip, {
      status: 'no_driver',
      actorType: 'system',
      note: 'No active driver found nearby.',
    });

    await trip.save();

    await logTripStatusTransition({
      trip,
      eventType: 'trip_no_driver_found',
      actorType: 'system',
      statusFrom: previousStatus,
      statusTo: trip.status,
      severity: 'warning',
      metadata: {
        excludedDriverIds,
      },
    }).catch(() => null);

    return null;
  }

  trip.driver = match.driver._id;
  if (Number.isFinite(Number(match.distanceKm))) {
    trip.distanceKmEstimate = Number(match.distanceKm);
  }
  trip.status = 'driver_assigned';
  trip.matchedAt = new Date();
  trip.driverResponseDeadlineAt = new Date(Date.now() + DRIVER_RESPONSE_WINDOW_SECONDS * 1000);
  trip.assignedFromAirportQueue = match.assignmentSource === 'airport_queue';
  trip.queueType = match.queueType || null;
  trip.queueGroup = match.queueGroup || null;
  trip.queueAirportCode = match.queueAirportCode || null;
  trip.queueEventCode = match.queueEventCode || null;
  trip.queueEntryId = match.queueEntryId || null;
  appendTripStatus(trip, {
    status: 'driver_assigned',
    actorType: 'system',
    actorId: String(match.driver._id),
    note:
      match.assignmentSource === 'airport_queue'
        ? 'Driver matched from airport FIFO queue.'
        : match.assignmentSource === 'event_queue'
        ? 'Driver matched from event temporary FIFO queue.'
        : 'Driver matched and notified.',
  });

  await trip.save();

  await logTripStatusTransition({
    trip,
    eventType: 'trip_driver_assigned',
    actorType: 'system',
    actorId: String(match.driver._id),
    statusFrom: previousStatus,
    statusTo: trip.status,
    severity: 'info',
    metadata: {
      assignmentSource: match.assignmentSource || 'nearby',
      queueType: match.queueType || null,
      queueGroup: match.queueGroup || null,
      queueEntryId: match.queueEntryId || null,
      queueAirportCode: match.queueAirportCode || null,
      queueEventCode: match.queueEventCode || null,
      excludedDriverIds,
    },
  }).catch(() => null);

  return {
    driverId: String(match.driver._id),
    distanceKm: match.distanceKm,
    assignmentSource: match.assignmentSource || 'nearby',
    queueType: match.queueType || null,
    queueGroup: match.queueGroup || null,
    queueEntryId: match.queueEntryId || null,
    queueAirportCode: match.queueAirportCode || null,
    queueEventCode: match.queueEventCode || null,
  };
}

async function requestTrip(req, res) {
  try {
    const {
      riderId,
      pickup,
      dropoff,
      surgeRadiusKm,
      rideCategory = 'rydinex_regular',
      bookingType = 'on_demand',
      scheduledAt = null,
      estimatedHours = null,
      serviceDogRequested = false,
      teenPickup = false,
      teenSeatingPolicy = 'none',
      specialInstructions = '',
      isPrearranged = false,
    } = req.body;

    const normalizedBookingType = normalizeBookingType(bookingType);
    const normalizedScheduledAt = parseScheduledAt(scheduledAt);
    const resolvedIsPrearranged = Boolean(isPrearranged || normalizedBookingType !== 'on_demand' || normalizedScheduledAt);

    if (!riderId) {
      return res.status(400).json({ message: 'riderId is required.' });
    }

    const rider = await Rider.findOne({ _id: riderId, status: 'active' }).select('_id name');
    if (!rider) {
      return res.status(404).json({ message: 'Active rider not found.' });
    }

    const activeTrip = await Trip.findOne({
      rider: riderId,
      status: { $in: ACTIVE_DRIVER_TRIP_STATUSES.concat(['searching', 'scheduled']) },
    }).select('_id status');

    if (activeTrip) {
      return res.status(409).json({
        message: 'Rider already has an active trip.',
        activeTrip,
      });
    }

    const normalizedPickup = normalizeTripPoint(pickup, 'pickup');
    const normalizedDropoff = normalizeTripPoint(dropoff, 'dropoff');

    const statePolicy = evaluateTripStatePolicy({
      pickup: normalizedPickup,
      dropoff: normalizedDropoff,
      rideCategory,
      isPrearranged: resolvedIsPrearranged,
    });

    if (!statePolicy.isAllowed) {
      return res
        .status(422)
        .json(buildTripStatePolicyErrorResponse(statePolicy, 'Trip request is not allowed for the selected states.'));
    }

    if (statePolicy.pickupStateCode) {
      normalizedPickup.state = statePolicy.pickupStateCode;
    }

    if (statePolicy.dropoffStateCode) {
      normalizedDropoff.state = statePolicy.dropoffStateCode;
    }

    if (statePolicy.pickupCountryCode) {
      normalizedPickup.country = statePolicy.pickupCountryCode;
    }

    if (statePolicy.dropoffCountryCode) {
      normalizedDropoff.country = statePolicy.dropoffCountryCode;
    }

    if (statePolicy.pickupCity) {
      normalizedPickup.city = statePolicy.pickupCity;
    }

    if (statePolicy.dropoffCity) {
      normalizedDropoff.city = statePolicy.dropoffCity;
    }

    const pricing = await calculateUpfrontPricing({
      pickup: normalizedPickup,
      dropoff: normalizedDropoff,
      surgeRadiusKm,
      rideCategory,
      bookingType: normalizedBookingType,
      scheduledAt: normalizedScheduledAt,
      estimatedHours,
      serviceDogRequested,
    });

    const resolvedTeenSeatingPolicy = teenPickup ? 'back_seat_only' : teenSeatingPolicy || 'none';
    const resolvedSpecialInstructions =
      String(specialInstructions || '').trim() || (teenPickup ? 'Teen rider must sit in the back seat.' : '');

    const shouldDeferDispatch = shouldDeferScheduledDispatch({
      bookingType: normalizedBookingType,
      scheduledAt: normalizedScheduledAt,
    });

    const initialStatus = shouldDeferDispatch ? 'scheduled' : 'searching';

    const trip = await Trip.create({
      rider: riderId,
      rideCategory: pricing.rideCategory || rideCategory || 'rydinex_regular',
      bookingType: normalizedBookingType,
      scheduledAt: normalizedScheduledAt,
      estimatedHours: pricing.estimatedHours || estimatedHours || null,
      reservationFee: pricing.reservationFee || 0,
      serviceDogRequested: Boolean(serviceDogRequested),
      serviceDogFee: pricing.serviceDogFee || 0,
      teenPickup: Boolean(teenPickup),
      teenSeatingPolicy: resolvedTeenSeatingPolicy,
      specialInstructions: resolvedSpecialInstructions,
      hourlyRate: pricing.hourlyRate || null,
      hourlySubtotal: pricing.hourlySubtotal || null,
      pickup: normalizedPickup,
      dropoff: normalizedDropoff,
      pickupCountry: statePolicy.pickupCountryCode || normalizedPickup.country || null,
      dropoffCountry: statePolicy.dropoffCountryCode || normalizedDropoff.country || null,
      pickupState: statePolicy.pickupStateCode || normalizedPickup.state || null,
      dropoffState: statePolicy.dropoffStateCode || normalizedDropoff.state || null,
      pickupCity: statePolicy.pickupCity || normalizedPickup.city || null,
      dropoffCity: statePolicy.dropoffCity || normalizedDropoff.city || null,
      isPrearranged: resolvedIsPrearranged,
      statePolicyVersion: statePolicy.policyVersion || null,
      distanceKmEstimate: pricing.distanceKm,
      distanceMilesEstimate: pricing.distanceMiles,
      durationMinutesEstimate: pricing.durationMinutes,
      fareEstimate: pricing.upfrontFare,
      upfrontFare: pricing.upfrontFare,
      surgeMultiplier: pricing.surgeMultiplier,
      demandRatio: pricing.demandRatio,
      platformCommission: pricing.platformCommission,
      platformCommissionRate: pricing.platformCommissionRate,
      driverEarnings: pricing.driverEarnings,
      airportFee: pricing.airportFee || 0,
      airportPickupCode: pricing.airportFeeDetails?.pickupAirportCode || null,
      airportDropoffCode: pricing.airportFeeDetails?.dropoffAirportCode || null,
      currency: pricing.currency,
      pricingBreakdown: pricing,
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          actorType: 'system',
          note: shouldDeferDispatch ? 'Scheduled reservation created.' : 'Trip created',
        },
      ],
    });

    await logTripStatusTransition({
      trip,
      eventType: 'trip_requested',
      actorType: 'rider',
      actorId: String(riderId),
      statusFrom: null,
      statusTo: trip.status,
      severity: 'info',
      metadata: {
        rideCategory: pricing.rideCategory || rideCategory || 'rydinex_regular',
        bookingType: normalizedBookingType,
        scheduledAt: normalizedScheduledAt,
        estimatedHours: pricing.estimatedHours || estimatedHours || null,
        reservationFee: pricing.reservationFee || 0,
        serviceDogRequested: Boolean(serviceDogRequested),
        serviceDogFee: pricing.serviceDogFee || 0,
        teenPickup: Boolean(teenPickup),
        teenSeatingPolicy: resolvedTeenSeatingPolicy,
        specialInstructions: resolvedSpecialInstructions,
        hourlyRate: pricing.hourlyRate || null,
        hourlySubtotal: pricing.hourlySubtotal || null,
        surgeMultiplier: pricing.surgeMultiplier,
        upfrontFare: pricing.upfrontFare,
        airportFee: pricing.airportFee || 0,
        airportPickupCode: pricing.airportFeeDetails?.pickupAirportCode || null,
        airportDropoffCode: pricing.airportFeeDetails?.dropoffAirportCode || null,
        pickupCountry: statePolicy.pickupCountryCode || normalizedPickup.country || null,
        dropoffCountry: statePolicy.dropoffCountryCode || normalizedDropoff.country || null,
        pickupState: statePolicy.pickupStateCode || normalizedPickup.state || null,
        dropoffState: statePolicy.dropoffStateCode || normalizedDropoff.state || null,
        pickupCity: statePolicy.pickupCity || normalizedPickup.city || null,
        dropoffCity: statePolicy.dropoffCity || normalizedDropoff.city || null,
        isPrearranged: resolvedIsPrearranged,
        statePolicyVersion: statePolicy.policyVersion || null,
      },
    }).catch(() => null);

    const assignment = shouldDeferDispatch ? null : await assignDriverToTrip(trip);

    const tripWithRefs = await Trip.findById(trip._id)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle status');

    if (assignment && tripWithRefs) {
      emitIncomingTripToDriver(req.app?.locals?.io, assignment.driverId, tripWithRefs);
    }

    return res.status(201).json({
      message: shouldDeferDispatch
        ? 'Reservation created and awaiting scheduled dispatch.'
        : assignment
        ? 'Trip requested and driver matched.'
        : 'Trip requested but no driver available yet.',
      pricing,
      statePolicy: buildTripStatePolicyPayload(statePolicy),
      trip: tripWithRefs,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to request trip.' });
  }
}

async function activateScheduledTrip(req, res) {
  try {
    const { tripId } = req.params;
    const { force = false } = req.body;

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle status');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (trip.status !== 'scheduled') {
      return res.status(400).json({ message: `Trip activation is only available for scheduled trips. Current status: ${trip.status}.` });
    }

    const scheduledAt = trip.scheduledAt ? new Date(trip.scheduledAt) : null;
    if (!force && scheduledAt) {
      const activationThresholdMs = scheduledAt.getTime() - Math.max(SCHEDULED_ASSIGNMENT_WINDOW_MINUTES, 1) * 60 * 1000;
      if (Date.now() < activationThresholdMs) {
        return res.status(409).json({
          message: 'Trip cannot be activated yet. It is outside the assignment window.',
          scheduledAt,
          assignmentWindowMinutes: Math.max(SCHEDULED_ASSIGNMENT_WINDOW_MINUTES, 1),
        });
      }
    }

    const previousStatus = trip.status;
    trip.status = 'searching';
    trip.driverResponseDeadlineAt = null;
    appendTripStatus(trip, {
      status: 'searching',
      actorType: 'system',
      note: force ? 'Scheduled trip manually activated.' : 'Scheduled trip activated for assignment window.',
    });

    await trip.save();

    await logTripStatusTransition({
      trip,
      eventType: 'trip_scheduled_activated',
      actorType: 'system',
      statusFrom: previousStatus,
      statusTo: trip.status,
      severity: 'info',
      metadata: {
        force: Boolean(force),
        scheduledAt,
        assignmentWindowMinutes: Math.max(SCHEDULED_ASSIGNMENT_WINDOW_MINUTES, 1),
      },
    }).catch(() => null);

    const assignment = await assignDriverToTrip(trip);

    const populatedTrip = await Trip.findById(trip._id)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle status');

    if (assignment && populatedTrip) {
      emitIncomingTripToDriver(req.app?.locals?.io, assignment.driverId, populatedTrip);
    }

    return res.status(200).json({
      message: assignment
        ? 'Scheduled trip activated and driver matched.'
        : 'Scheduled trip activated. No driver available yet.',
      trip: populatedTrip,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to activate scheduled trip.' });
  }
}

async function getIncomingTripsForDriver(req, res) {
  try {
    const { driverId } = req.params;

    const trips = await Trip.find({
      driver: driverId,
      status: 'driver_assigned',
    })
      .populate('rider', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json(trips);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch incoming trips.' });
  }
}

async function respondToTripRequest(req, res) {
  try {
    const { tripId } = req.params;
    const { driverId, action, declineReason } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required.' });
    }

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: "action must be either 'accept' or 'decline'." });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (!trip.driver || String(trip.driver) !== String(driverId)) {
      return res.status(403).json({ message: 'Trip is not assigned to this driver.' });
    }

    if (trip.status !== 'driver_assigned') {
      return res.status(400).json({ message: `Trip cannot be ${action}ed in current status ${trip.status}.` });
    }

    if (action === 'accept') {
      const previousStatus = trip.status;
      trip.status = 'driver_accepted';
      trip.acceptedAt = new Date();
      appendTripStatus(trip, {
        status: 'driver_accepted',
        actorType: 'driver',
        actorId: String(driverId),
        note: 'Driver accepted trip.',
      });

      await trip.save();

      await logTripStatusTransition({
        trip,
        eventType: 'trip_driver_accepted',
        actorType: 'driver',
        actorId: String(driverId),
        statusFrom: previousStatus,
        statusTo: trip.status,
        severity: 'info',
      }).catch(() => null);

      const populatedTrip = await Trip.findById(trip._id)
        .populate('rider', 'name phone email')
        .populate('driver', 'name phone email vehicle');

      return res.status(200).json({
        message: 'Trip accepted successfully.',
        trip: populatedTrip,
      });
    }

    trip.declineHistory.push({
      driver: driverId,
      reason: declineReason || 'Declined by driver',
      at: new Date(),
    });

    if (trip.assignedFromAirportQueue && trip.queueEntryId) {
      await exitAssignedQueueEntry({
        queueEntryId: trip.queueEntryId,
        reason: 'Driver declined airport queue trip request.',
      }).catch(() => null);
    }

    appendTripStatus(trip, {
      status: 'driver_assigned',
      actorType: 'driver',
      actorId: String(driverId),
      note: declineReason || 'Driver declined trip request.',
    });

    const excludedDriverIds = trip.declineHistory.map(entry => String(entry.driver));
    const assignment = await assignDriverToTrip(trip, excludedDriverIds);

    await logTripStatusTransition({
      trip,
      eventType: 'trip_driver_declined',
      actorType: 'driver',
      actorId: String(driverId),
      statusFrom: 'driver_assigned',
      statusTo: trip.status,
      severity: 'warning',
      metadata: {
        declineReason: declineReason || 'Declined by driver',
        reassigned: Boolean(assignment),
      },
    }).catch(() => null);

    const populatedTrip = await Trip.findById(trip._id)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    if (assignment && populatedTrip) {
      emitIncomingTripToDriver(req.app?.locals?.io, assignment.driverId, populatedTrip);
    }

    return res.status(200).json({
      message: assignment ? 'Trip declined and reassigned to another driver.' : 'Trip declined. No replacement driver found.',
      trip: populatedTrip,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to process driver response.' });
  }
}

async function updateTripStatus(req, res) {
  try {
    const { tripId } = req.params;
    const { status, actorType = 'system', actorId = null, note = '', cancelReason = '', finalFare = null } = req.body;

    if (!ALLOWED_STATUS_UPDATES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${ALLOWED_STATUS_UPDATES.join(', ')}`,
      });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    const previousStatus = trip.status;
    trip.status = status;

    if (status === 'completed') {
      const completionTime = new Date();
      trip.completedAt = completionTime;
      trip.endedAt = completionTime;

      if (!trip.startedAt) {
        trip.startedAt = trip.acceptedAt || completionTime;
      }

      trip.actualDurationMinutes = Number(
        Math.max((completionTime.getTime() - new Date(trip.startedAt).getTime()) / 60000, 0).toFixed(2)
      );

      const pricingFromMetrics = await calculateTripFareFromMetrics({
        distanceMiles: trip.actualDistanceMiles || trip.distanceMilesEstimate || 0,
        durationMinutes: trip.actualDurationMinutes || trip.durationMinutesEstimate || 0,
        surgeMultiplier: trip.surgeMultiplier || 1,
        pickup: trip.pickup,
        dropoff: trip.dropoff,
        rideCategory: trip.rideCategory || 'rydinex_regular',
        bookingType: trip.bookingType || 'on_demand',
        estimatedHours: trip.estimatedHours || null,
        serviceDogRequested: Boolean(trip.serviceDogRequested),
      });

      const parsedFinalFare = Number(finalFare);
      if (Number.isFinite(parsedFinalFare) && parsedFinalFare >= 0) {
        const payout = calculatePayoutFromFare(parsedFinalFare, pricingFromMetrics.platformCommissionRate);
        trip.fareEstimate = payout.totalFare;
        trip.upfrontFare = payout.totalFare;
        trip.platformCommission = payout.platformCommission;
        trip.platformCommissionRate = payout.platformCommissionRate;
        trip.driverEarnings = payout.driverEarnings;
        trip.airportFee = pricingFromMetrics.airportFee || trip.airportFee || 0;
        trip.serviceDogFee = pricingFromMetrics.serviceDogFee || trip.serviceDogFee || 0;
        trip.airportPickupCode = pricingFromMetrics.airportFeeDetails?.pickupAirportCode || trip.airportPickupCode || null;
        trip.airportDropoffCode = pricingFromMetrics.airportFeeDetails?.dropoffAirportCode || trip.airportDropoffCode || null;
        trip.currency = pricingFromMetrics.currency || trip.currency;

        trip.pricingBreakdown = {
          ...(trip.pricingBreakdown || {}),
          ...pricingFromMetrics,
          finalFare: payout.totalFare,
          platformCommission: payout.platformCommission,
          platformCommissionRate: payout.platformCommissionRate,
          driverEarnings: payout.driverEarnings,
        };
      } else {
        trip.fareEstimate = pricingFromMetrics.totalFare;
        trip.upfrontFare = pricingFromMetrics.totalFare;
        trip.platformCommission = pricingFromMetrics.platformCommission;
        trip.platformCommissionRate = pricingFromMetrics.platformCommissionRate;
        trip.driverEarnings = pricingFromMetrics.driverEarnings;
        trip.airportFee = pricingFromMetrics.airportFee || 0;
        trip.serviceDogFee = pricingFromMetrics.serviceDogFee || 0;
        trip.airportPickupCode = pricingFromMetrics.airportFeeDetails?.pickupAirportCode || null;
        trip.airportDropoffCode = pricingFromMetrics.airportFeeDetails?.dropoffAirportCode || null;
        trip.currency = pricingFromMetrics.currency;

        trip.pricingBreakdown = {
          ...(trip.pricingBreakdown || {}),
          ...pricingFromMetrics,
          finalFare: pricingFromMetrics.totalFare,
        };
      }

      trip.receipt = buildTripReceipt(trip);
    }

    if (status === 'cancelled') {
      trip.cancelledAt = new Date();
      trip.cancelReason = cancelReason || note || 'Cancelled';

      await createSafetyLog({
        incidentType: 'trip_cancelled',
        severity: 'medium',
        status: 'open',
        trip: trip._id,
        rider: trip.rider,
        driver: trip.driver,
        reportedByType: actorType === 'admin' ? 'admin' : actorType === 'driver' ? 'driver' : actorType === 'rider' ? 'rider' : 'system',
        reportedById: actorId ? String(actorId) : null,
        title: 'Trip cancelled',
        description: cancelReason || note || 'Cancelled',
        metadata: {
          previousStatus,
          updatedStatus: status,
        },
      }).catch(() => null);
    }

    appendTripStatus(trip, {
      status,
      actorType,
      actorId: actorId ? String(actorId) : null,
      note,
    });

    await trip.save();

    await logTripStatusTransition({
      trip,
      eventType: 'trip_status_updated',
      actorType,
      actorId: actorId ? String(actorId) : null,
      statusFrom: previousStatus,
      statusTo: status,
      severity: status === 'cancelled' ? 'warning' : 'info',
      metadata: {
        note,
        cancelReason,
      },
    }).catch(() => null);

    const populatedTrip = await Trip.findById(trip._id)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    return res.status(200).json({
      message: 'Trip status updated.',
      trip: populatedTrip,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update trip status.' });
  }
}

async function startTrip(req, res) {
  try {
    const { tripId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required.' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (!trip.driver || String(trip.driver) !== String(driverId)) {
      return res.status(403).json({ message: 'Trip is not assigned to this driver.' });
    }

    if (!['driver_accepted', 'driver_arrived_pickup', 'in_progress'].includes(trip.status)) {
      return res.status(400).json({ message: `Trip cannot be started in current status ${trip.status}.` });
    }

    if (!trip.startedAt) {
      trip.startedAt = new Date();
    }

    const previousStatus = trip.status;

    if (trip.status !== 'in_progress') {
      trip.status = 'in_progress';
      appendTripStatus(trip, {
        status: 'in_progress',
        actorType: 'driver',
        actorId: String(driverId),
        note: 'Trip started by driver.',
      });
    }

    const trackingPayload = req.body.routePoint || req.body.currentLocation || req.body;
    if (trackingPayload && trackingPayload.latitude !== undefined && trackingPayload.longitude !== undefined) {
      const routePoint = normalizeRoutePoint(trackingPayload);
      appendRoutePoint(trip, routePoint);
    }

    await trip.save();

    await logTripStatusTransition({
      trip,
      eventType: 'trip_started',
      actorType: 'driver',
      actorId: String(driverId),
      statusFrom: previousStatus,
      statusTo: trip.status,
      severity: 'info',
    }).catch(() => null);

    const populatedTrip = await Trip.findById(trip._id)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    return res.status(200).json({
      message: 'Trip started successfully.',
      trip: populatedTrip,
      summary: buildTripSummary(populatedTrip),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to start trip.' });
  }
}

async function trackTripRoute(req, res) {
  try {
    const { tripId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required.' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (!trip.driver || String(trip.driver) !== String(driverId)) {
      return res.status(403).json({ message: 'Trip is not assigned to this driver.' });
    }

    if (!['driver_accepted', 'driver_arrived_pickup', 'in_progress'].includes(trip.status)) {
      return res.status(400).json({ message: `Route tracking is not available in status ${trip.status}.` });
    }

    const routePoint = normalizeRoutePoint(req.body.routePoint || req.body.currentLocation || req.body);
    appendRoutePoint(trip, routePoint);

    if (trip.startedAt && ['in_progress', 'completed'].includes(trip.status)) {
      trip.actualDurationMinutes = Number(
        Math.max((Date.now() - new Date(trip.startedAt).getTime()) / 60000, 0).toFixed(2)
      );
    }

    await trip.save();

    return res.status(200).json({
      message: 'Route point tracked.',
      tripId: String(trip._id),
      status: trip.status,
      currentDriverLocation: trip.currentDriverLocation,
      actualDistanceKm: Number(Number(trip.actualDistanceKm || 0).toFixed(3)),
      actualDistanceMiles: Number(Number(trip.actualDistanceMiles || 0).toFixed(3)),
      actualDurationMinutes: Number(Number(trip.actualDurationMinutes || 0).toFixed(2)),
      routePointCount: trip.routePoints.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to track route point.' });
  }
}

async function endTrip(req, res) {
  try {
    const { tripId } = req.params;
    const { driverId, finalFare = null } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId is required.' });
    }

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (!trip.driver || String(trip.driver._id || trip.driver) !== String(driverId)) {
      return res.status(403).json({ message: 'Trip is not assigned to this driver.' });
    }

    if (!['in_progress', 'driver_arrived_pickup', 'driver_accepted'].includes(trip.status)) {
      return res.status(400).json({ message: `Trip cannot be ended in current status ${trip.status}.` });
    }

    const trackingPayload = req.body.routePoint || req.body.currentLocation || req.body;
    if (trackingPayload && trackingPayload.latitude !== undefined && trackingPayload.longitude !== undefined) {
      const routePoint = normalizeRoutePoint(trackingPayload);
      appendRoutePoint(trip, routePoint);
    }

    const now = new Date();
    if (!trip.startedAt) {
      trip.startedAt = trip.acceptedAt || now;
    }

    const previousStatus = trip.status;

    trip.endedAt = now;
    trip.completedAt = now;
    trip.status = 'completed';

    trip.actualDurationMinutes = Number(
      Math.max((trip.endedAt.getTime() - new Date(trip.startedAt).getTime()) / 60000, 0).toFixed(2)
    );

    const pricingFromMetrics = await calculateTripFareFromMetrics({
      distanceMiles: trip.actualDistanceMiles || trip.distanceMilesEstimate || 0,
      durationMinutes: trip.actualDurationMinutes || trip.durationMinutesEstimate || 0,
      surgeMultiplier: trip.surgeMultiplier || 1,
      pickup: trip.pickup,
      dropoff: trip.dropoff,
      rideCategory: trip.rideCategory || 'rydinex_regular',
      bookingType: trip.bookingType || 'on_demand',
      estimatedHours: trip.estimatedHours || null,
      serviceDogRequested: Boolean(trip.serviceDogRequested),
    });

    const parsedFinalFare = Number(finalFare);
    if (Number.isFinite(parsedFinalFare) && parsedFinalFare >= 0) {
      const payout = calculatePayoutFromFare(parsedFinalFare, pricingFromMetrics.platformCommissionRate);
      trip.fareEstimate = payout.totalFare;
      trip.upfrontFare = payout.totalFare;
      trip.platformCommission = payout.platformCommission;
      trip.platformCommissionRate = payout.platformCommissionRate;
      trip.driverEarnings = payout.driverEarnings;
      trip.airportFee = pricingFromMetrics.airportFee || trip.airportFee || 0;
      trip.serviceDogFee = pricingFromMetrics.serviceDogFee || trip.serviceDogFee || 0;
      trip.airportPickupCode = pricingFromMetrics.airportFeeDetails?.pickupAirportCode || trip.airportPickupCode || null;
      trip.airportDropoffCode = pricingFromMetrics.airportFeeDetails?.dropoffAirportCode || trip.airportDropoffCode || null;
      trip.currency = pricingFromMetrics.currency || trip.currency;

      trip.pricingBreakdown = {
        ...(trip.pricingBreakdown || {}),
        ...pricingFromMetrics,
        finalFare: payout.totalFare,
        platformCommission: payout.platformCommission,
        platformCommissionRate: payout.platformCommissionRate,
        driverEarnings: payout.driverEarnings,
      };
    } else {
      trip.fareEstimate = pricingFromMetrics.totalFare;
      trip.upfrontFare = pricingFromMetrics.totalFare;
      trip.platformCommission = pricingFromMetrics.platformCommission;
      trip.platformCommissionRate = pricingFromMetrics.platformCommissionRate;
      trip.driverEarnings = pricingFromMetrics.driverEarnings;
      trip.airportFee = pricingFromMetrics.airportFee || 0;
      trip.serviceDogFee = pricingFromMetrics.serviceDogFee || 0;
      trip.airportPickupCode = pricingFromMetrics.airportFeeDetails?.pickupAirportCode || null;
      trip.airportDropoffCode = pricingFromMetrics.airportFeeDetails?.dropoffAirportCode || null;
      trip.currency = pricingFromMetrics.currency;

      trip.pricingBreakdown = {
        ...(trip.pricingBreakdown || {}),
        ...pricingFromMetrics,
        finalFare: pricingFromMetrics.totalFare,
      };
    }

    appendTripStatus(trip, {
      status: 'completed',
      actorType: 'driver',
      actorId: String(driverId),
      note: 'Trip ended by driver.',
    });

    trip.receipt = buildTripReceipt(trip);
    await trip.save();

    await logTripStatusTransition({
      trip,
      eventType: 'trip_completed',
      actorType: 'driver',
      actorId: String(driverId),
      statusFrom: previousStatus,
      statusTo: trip.status,
      severity: 'info',
      metadata: {
        finalFare: trip.fareEstimate,
        airportFee: trip.airportFee || 0,
      },
    }).catch(() => null);

    return res.status(200).json({
      message: 'Trip ended successfully.',
      trip,
      summary: buildTripSummary(trip),
      receipt: trip.receipt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to end trip.' });
  }
}

async function getTripTracking(req, res) {
  try {
    const { tripId } = req.params;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));

    const trip = await Trip.findById(tripId)
      .select('status rideCategory bookingType scheduledAt estimatedHours reservationFee serviceDogRequested serviceDogFee teenPickup teenSeatingPolicy specialInstructions hourlyRate hourlySubtotal pickup dropoff pickupState dropoffState isPrearranged statePolicyVersion currentDriverLocation routePoints startedAt endedAt actualDistanceKm actualDistanceMiles actualDurationMinutes rider driver')
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    const routePoints = Array.isArray(trip.routePoints) ? trip.routePoints.slice(-limit) : [];

    return res.status(200).json({
      tripId: String(trip._id),
      status: trip.status,
      rideCategory: trip.rideCategory || 'rydinex_regular',
      bookingType: normalizeBookingType(trip.bookingType),
      scheduledAt: trip.scheduledAt || null,
      estimatedHours: trip.estimatedHours || null,
      reservationFee: toMoney(trip.reservationFee || 0),
      serviceDogRequested: Boolean(trip.serviceDogRequested),
      serviceDogFee: toMoney(trip.serviceDogFee || 0),
      teenPickup: Boolean(trip.teenPickup),
      teenSeatingPolicy: trip.teenSeatingPolicy || (trip.teenPickup ? 'back_seat_only' : 'none'),
      specialInstructions: trip.specialInstructions || (trip.teenPickup ? 'Teen rider must sit in the back seat.' : ''),
      hourlyRate: trip.hourlyRate !== null && trip.hourlyRate !== undefined ? toMoney(trip.hourlyRate) : null,
      hourlySubtotal: trip.hourlySubtotal !== null && trip.hourlySubtotal !== undefined ? toMoney(trip.hourlySubtotal) : null,
      startedAt: trip.startedAt,
      endedAt: trip.endedAt,
      pickup: trip.pickup,
      dropoff: trip.dropoff,
      pickupState: trip.pickupState || trip.pickup?.state || null,
      dropoffState: trip.dropoffState || trip.dropoff?.state || null,
      isPrearranged: Boolean(trip.isPrearranged),
      statePolicyVersion: trip.statePolicyVersion || null,
      rider: trip.rider,
      driver: trip.driver,
      currentDriverLocation: trip.currentDriverLocation,
      routePoints,
      actualDistanceKm: Number(Number(trip.actualDistanceKm || 0).toFixed(3)),
      actualDistanceMiles: Number(Number(trip.actualDistanceMiles || 0).toFixed(3)),
      actualDurationMinutes: Number(Number(trip.actualDurationMinutes || 0).toFixed(2)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch trip tracking.' });
  }
}

async function getTripSummary(req, res) {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    return res.status(200).json(buildTripSummary(trip));
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch trip summary.' });
  }
}

async function generateTripReceipt(req, res) {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (trip.status !== 'completed') {
      return res.status(400).json({ message: 'Receipt can only be generated for completed trips.' });
    }

    trip.receipt = buildTripReceipt(trip);
    await trip.save();

    return res.status(200).json(trip.receipt);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to generate receipt.' });
  }
}

async function getTripReceipt(req, res) {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (trip.status !== 'completed') {
      return res.status(404).json({ message: 'Receipt not available yet.' });
    }

    const latestReceipt = buildTripReceipt(trip);

    if (!trip.receipt) {
      trip.receipt = latestReceipt;
      await trip.save();
    }

    return res.status(200).json(latestReceipt);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch receipt.' });
  }
}

async function updateTripTip(req, res) {
  try {
    const { tripId } = req.params;
    const { riderId, tipAmount } = req.body;

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (!['in_progress', 'completed'].includes(trip.status)) {
      return res.status(400).json({ message: 'Tip can only be updated after trip has started.' });
    }

    if (!trip.rider || String(trip.rider._id || trip.rider) !== String(riderId)) {
      return res.status(403).json({ message: 'Tip can only be updated by the rider who booked this trip.' });
    }

    const normalizedTipAmount = toMoney(tipAmount);
    const previousTipAmount = toMoney(trip.tipAmount || 0);

    trip.tipAmount = normalizedTipAmount;
    trip.tipUpdatedAt = new Date();
    trip.receipt = buildTripReceipt(trip);

    await trip.save();

    await logTripStatusTransition({
      trip,
      eventType: 'trip_tip_updated',
      actorType: 'rider',
      actorId: String(riderId),
      statusFrom: trip.status,
      statusTo: trip.status,
      severity: 'info',
      metadata: {
        previousTipAmount,
        tipAmount: normalizedTipAmount,
      },
    }).catch(() => null);

    return res.status(200).json({
      message: 'Tip updated successfully.',
      tripId: String(trip._id),
      previousTipAmount,
      tipAmount: normalizedTipAmount,
      tipPolicy: resolveTripTipPolicy(trip),
      receipt: trip.receipt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update trip tip.' });
  }
}

async function updateTripFeedback(req, res) {
  try {
    const { tripId } = req.params;
    const {
      riderId,
      overallRating,
      driverProfessionalismRating,
      carCleanlinessRating,
      amenitiesRating,
      greetingRating,
      comments,
      tipAmount,
    } = req.body;

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (!['in_progress', 'completed'].includes(trip.status)) {
      return res.status(400).json({ message: 'Feedback can only be updated after trip has started.' });
    }

    if (!trip.rider || String(trip.rider._id || trip.rider) !== String(riderId)) {
      return res.status(403).json({ message: 'Feedback can only be updated by the rider who booked this trip.' });
    }

    const previousFeedback = buildRiderFeedbackSummary(trip);
    const previousTipAmount = toMoney(trip.tipAmount || 0);
    let hasUpdates = false;

    if (overallRating !== null) {
      trip.riderOverallRating = overallRating;
      hasUpdates = true;
    }

    if (driverProfessionalismRating !== null) {
      trip.riderProfessionalismRating = driverProfessionalismRating;
      hasUpdates = true;
    }

    if (carCleanlinessRating !== null) {
      trip.riderCarCleanlinessRating = carCleanlinessRating;
      hasUpdates = true;
    }

    if (amenitiesRating !== null) {
      trip.riderAmenitiesRating = amenitiesRating;
      hasUpdates = true;
    }

    if (greetingRating !== null) {
      trip.riderGreetingRating = greetingRating;
      hasUpdates = true;
    }

    if (typeof comments === 'string') {
      trip.riderFeedbackComment = comments.trim();
      hasUpdates = true;
    }

    if (tipAmount !== null && tipAmount !== undefined) {
      trip.tipAmount = toMoney(tipAmount);
      trip.tipUpdatedAt = new Date();
      hasUpdates = true;
    }

    if (!hasUpdates) {
      return res.status(400).json({ message: 'No feedback updates provided.' });
    }

    const hasAnyRatingOrComment = Boolean(
      trip.riderOverallRating ||
        trip.riderProfessionalismRating ||
        trip.riderCarCleanlinessRating ||
        trip.riderAmenitiesRating ||
        trip.riderGreetingRating ||
        String(trip.riderFeedbackComment || '').trim()
    );

    const now = new Date();
    trip.riderFeedbackUpdatedAt = now;

    if (hasAnyRatingOrComment && !trip.riderFeedbackSubmittedAt) {
      trip.riderFeedbackSubmittedAt = now;
    }

    trip.receipt = buildTripReceipt(trip);
    await trip.save();

    const updatedFeedback = buildRiderFeedbackSummary(trip);

    await logTripStatusTransition({
      trip,
      eventType: 'trip_rider_feedback_updated',
      actorType: 'rider',
      actorId: String(riderId),
      statusFrom: trip.status,
      statusTo: trip.status,
      severity: 'info',
      metadata: {
        previousTipAmount,
        tipAmount: toMoney(trip.tipAmount || 0),
        previousFeedback,
        feedback: updatedFeedback,
      },
    }).catch(() => null);

    return res.status(200).json({
      message: 'Trip feedback updated successfully.',
      tripId: String(trip._id),
      tipAmount: toMoney(trip.tipAmount || 0),
      feedback: updatedFeedback,
      receipt: trip.receipt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update trip feedback.' });
  }
}

async function updateTripDriverFeedback(req, res) {
  try {
    const { tripId } = req.params;
    const { driverId, overallRating, safetyRating, respectRating, comments } = req.body;

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    if (!['in_progress', 'completed'].includes(trip.status)) {
      return res.status(400).json({ message: 'Rider feedback can only be updated after trip has started.' });
    }

    if (!trip.driver || String(trip.driver._id || trip.driver) !== String(driverId)) {
      return res.status(403).json({ message: 'Rider feedback can only be updated by the assigned driver.' });
    }

    const previousFeedback = buildDriverRiderFeedbackSummary(trip);
    let hasUpdates = false;

    if (overallRating !== null) {
      trip.driverRiderOverallRating = overallRating;
      hasUpdates = true;
    }

    if (safetyRating !== null) {
      trip.driverRiderSafetyRating = safetyRating;
      hasUpdates = true;
    }

    if (respectRating !== null) {
      trip.driverRiderRespectRating = respectRating;
      hasUpdates = true;
    }

    if (typeof comments === 'string') {
      trip.driverRiderFeedbackComment = comments.trim();
      hasUpdates = true;
    }

    if (!hasUpdates) {
      return res.status(400).json({ message: 'No rider feedback updates provided.' });
    }

    const hasAnyRatingOrComment = Boolean(
      trip.driverRiderOverallRating ||
        trip.driverRiderSafetyRating ||
        trip.driverRiderRespectRating ||
        String(trip.driverRiderFeedbackComment || '').trim()
    );

    const now = new Date();
    trip.driverRiderFeedbackUpdatedAt = now;

    if (hasAnyRatingOrComment && !trip.driverRiderFeedbackSubmittedAt) {
      trip.driverRiderFeedbackSubmittedAt = now;
    }

    if (trip.status === 'completed') {
      trip.receipt = buildTripReceipt(trip);
    }

    await trip.save();

    const updatedFeedback = buildDriverRiderFeedbackSummary(trip);

    await logTripStatusTransition({
      trip,
      eventType: 'trip_driver_feedback_updated',
      actorType: 'driver',
      actorId: String(driverId),
      statusFrom: trip.status,
      statusTo: trip.status,
      severity: 'info',
      metadata: {
        previousFeedback,
        feedback: updatedFeedback,
      },
    }).catch(() => null);

    return res.status(200).json({
      message: 'Rider feedback updated successfully.',
      tripId: String(trip._id),
      feedback: updatedFeedback,
      receipt: trip.receipt || null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update rider feedback.' });
  }
}

async function getPendingTripFeedbackForRider(req, res) {
  try {
    const { riderId } = req.params;

    const trip = await Trip.findOne({
      rider: riderId,
      status: 'completed',
      $or: [{ riderFeedbackSubmittedAt: null }, { riderFeedbackSubmittedAt: { $exists: false } }],
    })
      .populate('driver', 'name phone email vehicle')
      .sort({ completedAt: -1, createdAt: -1 });

    if (!trip) {
      return res.status(404).json({
        message: 'No pending trip feedback found.',
      });
    }

    const summary = buildTripSummary(trip);

    return res.status(200).json({
      hasPendingFeedback: true,
      tripId: String(trip._id),
      completedAt: trip.completedAt || trip.endedAt || trip.createdAt,
      driver: summary.driver,
      fare: {
        finalFare: summary.finalFare,
        tipAmount: summary.tipAmount,
        tipPresetOptions: summary.tipPresetOptions,
      },
      feedback: summary.riderFeedback,
      promptMessage: 'Do you want to rate this driver and add a tip?',
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load pending trip feedback.' });
  }
}

async function getTripById(req, res) {
  try {
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle status');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    return res.status(200).json(trip);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch trip.' });
  }
}

async function getActiveTripForRider(req, res) {
  try {
    const { riderId } = req.params;

    const trip = await Trip.findOne({
      rider: riderId,
      status: {
        $in: ['scheduled', 'searching', 'driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'],
      },
    })
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email vehicle status')
      .sort({ createdAt: -1 });

    if (!trip) {
      return res.status(404).json({ message: 'No active trip found for rider.' });
    }

    return res.status(200).json(trip);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch rider active trip.' });
  }
}

async function getCurrentTripForDriver(req, res) {
  try {
    const { driverId } = req.params;

    const trip = await Trip.findOne({
      driver: driverId,
      status: {
        $in: ['driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'],
      },
    })
      .populate('rider', 'name phone email')
      .sort({ createdAt: -1 });

    if (!trip) {
      return res.status(404).json({ message: 'No active trip found for driver.' });
    }

    return res.status(200).json(trip);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch driver current trip.' });
  }
}

module.exports = {
  getUpfrontPricingQuote,
  requestTrip,
  activateScheduledTrip,
  getIncomingTripsForDriver,
  respondToTripRequest,
  startTrip,
  trackTripRoute,
  endTrip,
  updateTripStatus,
  getTripTracking,
  getTripSummary,
  generateTripReceipt,
  getTripReceipt,
  updateTripTip,
  updateTripFeedback,
  updateTripDriverFeedback,
  getPendingTripFeedbackForRider,
  getTripById,
  getActiveTripForRider,
  getCurrentTripForDriver,
};
