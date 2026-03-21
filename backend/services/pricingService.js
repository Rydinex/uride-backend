const Trip = require('../models/Trip');
const { queryNearbyDrivers } = require('./activeDriversStore');
const {
  getEffectiveSystemConfig,
  RIDE_CATEGORIES,
  DEFAULT_RIDE_CATEGORY: DEFAULT_CONFIGURED_RIDE_CATEGORY,
  normalizeRideCategory: normalizeConfiguredRideCategory,
} = require('./configService');
const { getAirportByPoint } = require('./airportGeofenceService');

const DEFAULT_RIDE_CATEGORY = DEFAULT_CONFIGURED_RIDE_CATEGORY || 'rydinex_regular';
const DEFAULT_BOOKING_TYPE = 'on_demand';
const SUPPORTED_BOOKING_TYPES = ['on_demand', 'reservation', 'hourly'];

const CATEGORY_SHAPE_ALIASES = {
  rydinex_regular: ['rydinex_regular', 'regular'],
  rydinex_comfort: ['rydinex_comfort', 'comfort', 'black_car'],
  rydinex_xl: ['rydinex_xl', 'xl', 'black_suv', 'suv', 'rydnex_xl'],
  rydinex_green: ['rydinex_green', 'green'],
};

const FALLBACK_CONFIG = {
  pricing: {
    baseFare: Number(process.env.PRICING_BASE_FARE || 2.5),
    perMileRate: Number(process.env.PRICING_PER_MILE_RATE || 1.3),
    perMinuteRate: Number(process.env.PRICING_PER_MINUTE_RATE || 0.32),
    averageSpeedMph: Number(process.env.PRICING_AVERAGE_SPEED_MPH || 20),
    currency: process.env.PRICING_CURRENCY || 'USD',
    // 30% platform / 70% driver payout split.
    platformCommissionRate: Number(process.env.PLATFORM_COMMISSION_RATE || 0.3),
    categoryRates: {
      rydinex_regular: {
        baseFare: Number(process.env.PRICING_RYDINEX_REGULAR_BASE_FARE || 2.5),
        perMinuteRate: Number(process.env.PRICING_RYDINEX_REGULAR_PER_MINUTE || 0.32),
        perMileRate: Number(process.env.PRICING_RYDINEX_REGULAR_PER_MILE || 1.3),
      },
      rydinex_comfort: {
        baseFare: Number(process.env.PRICING_RYDINEX_COMFORT_BASE_FARE || process.env.PRICING_BLACK_CAR_BASE_FARE || 3.85),
        perMinuteRate: Number(process.env.PRICING_RYDINEX_COMFORT_PER_MINUTE || process.env.PRICING_BLACK_CAR_PER_MINUTE || 0.38),
        perMileRate: Number(process.env.PRICING_RYDINEX_COMFORT_PER_MILE || process.env.PRICING_BLACK_CAR_PER_MILE || 1.55),
      },
      rydinex_xl: {
        baseFare: Number(process.env.PRICING_RYDINEX_XL_BASE_FARE || process.env.PRICING_BLACK_SUV_BASE_FARE || process.env.PRICING_SUV_BASE_FARE || 5.6),
        perMinuteRate: Number(process.env.PRICING_RYDINEX_XL_PER_MINUTE || process.env.PRICING_BLACK_SUV_PER_MINUTE || process.env.PRICING_SUV_PER_MINUTE || 0.47),
        perMileRate: Number(process.env.PRICING_RYDINEX_XL_PER_MILE || process.env.PRICING_BLACK_SUV_PER_MILE || process.env.PRICING_SUV_PER_MILE || 2.05),
      },
      rydinex_green: {
        baseFare: Number(process.env.PRICING_RYDINEX_GREEN_BASE_FARE || 2.85),
        perMinuteRate: Number(process.env.PRICING_RYDINEX_GREEN_PER_MINUTE || 0.34),
        perMileRate: Number(process.env.PRICING_RYDINEX_GREEN_PER_MILE || 1.35),
      },
    },
    bookingDefaults: {
      reservationFee: Number(process.env.PRICING_RESERVATION_FEE || 0),
      serviceDogFee: Number(process.env.PRICING_SERVICE_DOG_FEE || 0),
      minimumHourlyHours: Number(process.env.PRICING_HOURLY_MIN_HOURS || 2),
      categoryHourlyRates: {
        rydinex_regular: {
          hourlyRate: Number(process.env.PRICING_RYDINEX_REGULAR_HOURLY_RATE || 45),
        },
        rydinex_comfort: {
          hourlyRate: Number(process.env.PRICING_RYDINEX_COMFORT_HOURLY_RATE || process.env.PRICING_BLACK_CAR_HOURLY_RATE || 58),
        },
        rydinex_xl: {
          hourlyRate: Number(process.env.PRICING_RYDINEX_XL_HOURLY_RATE || process.env.PRICING_BLACK_SUV_HOURLY_RATE || process.env.PRICING_SUV_HOURLY_RATE || 74),
        },
        rydinex_green: {
          hourlyRate: Number(process.env.PRICING_RYDINEX_GREEN_HOURLY_RATE || 49),
        },
      },
    },
  },
  surge: {
    demandRadiusKm: Number(process.env.SURGE_DEMAND_RADIUS_KM || 5),
    sensitivity: Number(process.env.SURGE_SENSITIVITY || 0.7),
    maxMultiplier: Number(process.env.SURGE_MAX_MULTIPLIER || 2.8),
    categoryMultipliers: {
      rydinex_regular: {
        sensitivity: Number(process.env.SURGE_RYDINEX_REGULAR_SENSITIVITY || 0.7),
        maxMultiplier: Number(process.env.SURGE_RYDINEX_REGULAR_MAX_MULTIPLIER || 2.8),
      },
      rydinex_comfort: {
        sensitivity: Number(process.env.SURGE_RYDINEX_COMFORT_SENSITIVITY || process.env.SURGE_BLACK_CAR_SENSITIVITY || 0.78),
        maxMultiplier: Number(process.env.SURGE_RYDINEX_COMFORT_MAX_MULTIPLIER || process.env.SURGE_BLACK_CAR_MAX_MULTIPLIER || 3),
      },
      rydinex_xl: {
        sensitivity: Number(process.env.SURGE_RYDINEX_XL_SENSITIVITY || process.env.SURGE_BLACK_SUV_SENSITIVITY || process.env.SURGE_SUV_SENSITIVITY || 0.86),
        maxMultiplier: Number(process.env.SURGE_RYDINEX_XL_MAX_MULTIPLIER || process.env.SURGE_BLACK_SUV_MAX_MULTIPLIER || process.env.SURGE_SUV_MAX_MULTIPLIER || 3.4),
      },
      rydinex_green: {
        sensitivity: Number(process.env.SURGE_RYDINEX_GREEN_SENSITIVITY || 0.72),
        maxMultiplier: Number(process.env.SURGE_RYDINEX_GREEN_MAX_MULTIPLIER || 2.9),
      },
    },
  },
  airportFees: {
    ORD: {
      pickupFee: Number(process.env.AIRPORT_PICKUP_FEE_ORD || 5.5),
      dropoffFee: Number(process.env.AIRPORT_DROPOFF_FEE_ORD || 3.5),
    },
    MDW: {
      pickupFee: Number(process.env.AIRPORT_PICKUP_FEE_MDW || 4.5),
      dropoffFee: Number(process.env.AIRPORT_DROPOFF_FEE_MDW || 2.5),
    },
  },
};

const DEMAND_STATUSES = ['searching', 'driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'];

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundMoney(value) {
  return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRideCategory(value, fallback = DEFAULT_RIDE_CATEGORY) {
  const normalized = normalizeConfiguredRideCategory(value);
  return normalized || fallback;
}

function normalizeBookingType(value, fallback = DEFAULT_BOOKING_TYPE) {
  const normalized = String(value || '').trim().toLowerCase();
  if (SUPPORTED_BOOKING_TYPES.includes(normalized)) {
    return normalized;
  }

  return fallback;
}

function normalizePoint(point, fieldName) {
  if (!point || typeof point !== 'object') {
    throw new Error(`${fieldName} is required.`);
  }

  const latitude = toNumber(point.latitude);
  const longitude = toNumber(point.longitude);

  if (latitude === null || longitude === null) {
    throw new Error(`${fieldName}.latitude and ${fieldName}.longitude must be valid numbers.`);
  }

  return {
    latitude,
    longitude,
    address: point.address || '',
  };
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

function estimateDurationMinutes(distanceMiles, averageSpeedMph) {
  const safeSpeed = Math.max(Number(averageSpeedMph) || FALLBACK_CONFIG.pricing.averageSpeedMph, 5);
  const estimatedMinutes = (distanceMiles / safeSpeed) * 60;
  return Math.max(1, estimatedMinutes);
}

function calculateAirportFeeDetails({ pickup = null, dropoff = null }) {
  const pickupAirport = getAirportByPoint(pickup || null);
  const dropoffAirport = getAirportByPoint(dropoff || null);

  const pickupAirportCode = pickupAirport?.code || null;
  const dropoffAirportCode = dropoffAirport?.code || null;

  const pickupFee = pickupAirportCode
    ? Number(FALLBACK_CONFIG.airportFees[pickupAirportCode]?.pickupFee || 0)
    : 0;
  const dropoffFee = dropoffAirportCode
    ? Number(FALLBACK_CONFIG.airportFees[dropoffAirportCode]?.dropoffFee || 0)
    : 0;

  const totalAirportFee = roundMoney(Math.max(pickupFee, 0) + Math.max(dropoffFee, 0));

  return {
    pickupAirportCode,
    dropoffAirportCode,
    pickupFee: roundMoney(Math.max(pickupFee, 0)),
    dropoffFee: roundMoney(Math.max(dropoffFee, 0)),
    totalAirportFee,
  };
}

function resolveCategoryShapeValue(sourceMap = {}, category) {
  if (!sourceMap || typeof sourceMap !== 'object') {
    return null;
  }

  const aliasKeys = CATEGORY_SHAPE_ALIASES[category] || [category];

  for (const key of aliasKeys) {
    if (!Object.prototype.hasOwnProperty.call(sourceMap, key)) {
      continue;
    }

    const value = sourceMap[key];
    if (value && typeof value === 'object') {
      return value;
    }
  }

  return null;
}

function mergeCategoryShape(fallbackMap = {}, candidateMap = {}) {
  const merged = {};

  Object.keys(fallbackMap).forEach(category => {
    const normalizedCandidateValue = resolveCategoryShapeValue(candidateMap, category) || {};

    merged[category] = {
      ...(fallbackMap[category] || {}),
      ...normalizedCandidateValue,
    };
  });

  return merged;
}

async function resolveSystemConfig(configOverride = null) {
  const sourceConfig = configOverride
    ? {
        pricing: configOverride.pricing || {},
        surge: configOverride.surge || {},
      }
    : await getEffectiveSystemConfig();

  const sourceBookingDefaults = sourceConfig.pricing?.bookingDefaults || {};

  const pricing = {
    ...FALLBACK_CONFIG.pricing,
    ...(sourceConfig.pricing || {}),
    categoryRates: mergeCategoryShape(
      FALLBACK_CONFIG.pricing.categoryRates,
      sourceConfig.pricing?.categoryRates || {}
    ),
    bookingDefaults: {
      ...FALLBACK_CONFIG.pricing.bookingDefaults,
      ...sourceBookingDefaults,
      categoryHourlyRates: mergeCategoryShape(
        FALLBACK_CONFIG.pricing.bookingDefaults.categoryHourlyRates,
        sourceBookingDefaults.categoryHourlyRates || {}
      ),
    },
  };

  const surge = {
    ...FALLBACK_CONFIG.surge,
    ...(sourceConfig.surge || {}),
    categoryMultipliers: mergeCategoryShape(
      FALLBACK_CONFIG.surge.categoryMultipliers,
      sourceConfig.surge?.categoryMultipliers || {}
    ),
  };

  return {
    pricing,
    surge,
  };
}

function resolveCategoryBookingProfile(pricingConfig, rideCategory) {
  const normalizedCategory = normalizeRideCategory(rideCategory);

  const bookingDefaults = pricingConfig?.bookingDefaults || FALLBACK_CONFIG.pricing.bookingDefaults;
  const categoryHourlyRates = bookingDefaults.categoryHourlyRates || {};

  const configuredCategoryHourlyRate = resolveCategoryShapeValue(categoryHourlyRates, normalizedCategory) || {};
  const fallbackCategoryHourlyRate =
    resolveCategoryShapeValue(FALLBACK_CONFIG.pricing.bookingDefaults.categoryHourlyRates, normalizedCategory) || {};

  return {
    rideCategory: normalizedCategory,
    reservationFee: Number(
      bookingDefaults.reservationFee ?? FALLBACK_CONFIG.pricing.bookingDefaults.reservationFee ?? 0
    ),
    serviceDogFee: Number(
      bookingDefaults.serviceDogFee ?? FALLBACK_CONFIG.pricing.bookingDefaults.serviceDogFee ?? 0
    ),
    minimumHourlyHours: Number(
      bookingDefaults.minimumHourlyHours ?? FALLBACK_CONFIG.pricing.bookingDefaults.minimumHourlyHours ?? 1
    ),
    hourlyRate: Number(
      configuredCategoryHourlyRate.hourlyRate ??
        fallbackCategoryHourlyRate.hourlyRate ??
        0
    ),
  };
}

function resolveCategoryRate(pricingConfig, rideCategory) {
  const normalizedCategory = normalizeRideCategory(rideCategory);
  const configuredRate = resolveCategoryShapeValue(pricingConfig?.categoryRates || {}, normalizedCategory) || {};
  const fallbackRate = resolveCategoryShapeValue(FALLBACK_CONFIG.pricing.categoryRates, normalizedCategory) || {};

  return {
    rideCategory: normalizedCategory,
    baseFare: Number(configuredRate.baseFare ?? fallbackRate.baseFare ?? pricingConfig.baseFare ?? FALLBACK_CONFIG.pricing.baseFare),
    perMileRate: Number(
      configuredRate.perMileRate ?? fallbackRate.perMileRate ?? pricingConfig.perMileRate ?? FALLBACK_CONFIG.pricing.perMileRate
    ),
    perMinuteRate: Number(
      configuredRate.perMinuteRate ?? fallbackRate.perMinuteRate ?? pricingConfig.perMinuteRate ?? FALLBACK_CONFIG.pricing.perMinuteRate
    ),
  };
}

function resolveCategorySurgeProfile(surgeConfig, rideCategory) {
  const normalizedCategory = normalizeRideCategory(rideCategory);
  const configuredProfile = resolveCategoryShapeValue(surgeConfig?.categoryMultipliers || {}, normalizedCategory) || {};
  const fallbackProfile = resolveCategoryShapeValue(FALLBACK_CONFIG.surge.categoryMultipliers, normalizedCategory) || {};

  return {
    rideCategory: normalizedCategory,
    sensitivity: Number(
      configuredProfile.sensitivity ?? fallbackProfile.sensitivity ?? surgeConfig.sensitivity ?? FALLBACK_CONFIG.surge.sensitivity
    ),
    maxMultiplier: Number(
      configuredProfile.maxMultiplier ?? fallbackProfile.maxMultiplier ?? surgeConfig.maxMultiplier ?? FALLBACK_CONFIG.surge.maxMultiplier
    ),
  };
}

async function getDemandMetrics(pickup, radiusKm, surgeConfig) {
  const effectiveRadiusKm = Math.max(
    0.5,
    Number(radiusKm) || Number(surgeConfig?.demandRadiusKm) || FALLBACK_CONFIG.surge.demandRadiusKm
  );

  const [nearbyDrivers, demandTrips] = await Promise.all([
    queryNearbyDrivers({
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      radiusKm: effectiveRadiusKm,
      limit: 200,
    }),
    Trip.find({ status: { $in: DEMAND_STATUSES } }).select('pickup'),
  ]);

  const supplyCount = Array.isArray(nearbyDrivers) ? nearbyDrivers.length : 0;

  const demandCount = demandTrips.reduce((count, trip) => {
    if (!trip.pickup) {
      return count;
    }

    const tripDistanceKm = haversineDistanceKm(pickup, {
      latitude: trip.pickup.latitude,
      longitude: trip.pickup.longitude,
    });

    return tripDistanceKm <= effectiveRadiusKm ? count + 1 : count;
  }, 0);

  let demandRatio = 1;
  if (supplyCount === 0) {
    demandRatio = demandCount > 0 ? demandCount : 1;
  } else {
    demandRatio = demandCount / supplyCount;
  }

  return {
    demandCount,
    supplyCount,
    demandRatio: Number(demandRatio.toFixed(2)),
    radiusKm: effectiveRadiusKm,
  };
}

function calculateSurgeMultiplier(demandRatio, surgeProfile) {
  const sensitivity = Number(surgeProfile?.sensitivity) || FALLBACK_CONFIG.surge.sensitivity;
  const maxMultiplier = Number(surgeProfile?.maxMultiplier) || FALLBACK_CONFIG.surge.maxMultiplier;

  if (!Number.isFinite(demandRatio) || demandRatio <= 1) {
    return 1;
  }

  const surge = 1 + (demandRatio - 1) * sensitivity;
  return Number(clamp(surge, 1, maxMultiplier).toFixed(2));
}

function calculatePayoutFromFare(totalFare, commissionRate = null) {
  const safeFare = Math.max(Number(totalFare) || 0, 0);
  const effectiveCommissionRate =
    commissionRate !== null && Number.isFinite(Number(commissionRate))
      ? Number(commissionRate)
      : FALLBACK_CONFIG.pricing.platformCommissionRate;

  const platformCommission = roundMoney(safeFare * effectiveCommissionRate);
  const driverEarnings = roundMoney(safeFare - platformCommission);

  return {
    totalFare: roundMoney(safeFare),
    platformCommission,
    platformCommissionRate: Number(effectiveCommissionRate.toFixed(4)),
    driverEarnings,
    driverPayoutRate: Number((1 - effectiveCommissionRate).toFixed(4)),
  };
}

function deriveSurgeTrend(demandRatio) {
  if (!Number.isFinite(Number(demandRatio))) {
    return 'stable';
  }

  if (Number(demandRatio) >= 1.25) {
    return 'rising';
  }

  if (Number(demandRatio) <= 0.9) {
    return 'cooling';
  }

  return 'stable';
}

function buildSurgeForecast(currentMultiplier, demandRatio, maxMultiplier) {
  const trend = deriveSurgeTrend(demandRatio);
  const trendDelta = trend === 'rising' ? 0.15 : trend === 'cooling' ? -0.12 : 0;

  const windows = [15, 30, 45];

  return windows.map((minutes, index) => {
    const projectedMultiplier = clamp(currentMultiplier + trendDelta * (index + 1), 1, maxMultiplier);

    return {
      minutesAhead: minutes,
      projectedMultiplier: Number(projectedMultiplier.toFixed(2)),
      confidence: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      trend,
    };
  });
}

function buildSurgeTransparency(demandMetrics, surgeProfile, appliedMultiplier) {
  const sensitivity = Number(surgeProfile?.sensitivity) || FALLBACK_CONFIG.surge.sensitivity;
  const maxMultiplier = Number(surgeProfile?.maxMultiplier) || FALLBACK_CONFIG.surge.maxMultiplier;

  const rawMultiplier =
    Number(demandMetrics?.demandRatio) <= 1
      ? 1
      : 1 + (Number(demandMetrics?.demandRatio) - 1) * sensitivity;

  return {
    formula: '1 + (demandRatio - 1) * sensitivity',
    sensitivity: Number(sensitivity.toFixed(3)),
    maxMultiplier: Number(maxMultiplier.toFixed(2)),
    rawMultiplier: Number(rawMultiplier.toFixed(2)),
    appliedMultiplier: Number(Number(appliedMultiplier || 1).toFixed(2)),
  };
}

function calculateBookingBreakdown({
  bookingType,
  serviceDogRequested,
  distanceMiles,
  durationMinutes,
  estimatedHours,
  categoryRate,
  bookingProfile,
  airportFee,
}) {
  const normalizedBookingType = normalizeBookingType(bookingType, DEFAULT_BOOKING_TYPE);

  const safeDistanceMiles = Math.max(Number(distanceMiles) || 0, 0);
  const safeDurationMinutes = Math.max(Number(durationMinutes) || 0, 0);

  const safeReservationFee =
    normalizedBookingType === 'reservation'
      ? roundMoney(Math.max(Number(bookingProfile?.reservationFee) || 0, 0))
      : 0;

  const safeServiceDogFee = serviceDogRequested
    ? roundMoney(Math.max(Number(bookingProfile?.serviceDogFee) || 0, 0))
    : 0;

  if (normalizedBookingType === 'hourly') {
    const minimumHourlyHours = Math.max(Number(bookingProfile?.minimumHourlyHours) || 1, 1);
    const safeEstimatedHours = Math.max(Number(estimatedHours) || 0, 0);
    const billableHours = Number(
      clamp(Math.max(safeEstimatedHours, safeDurationMinutes / 60, minimumHourlyHours), minimumHourlyHours, 24).toFixed(2)
    );

    const hourlyRate = roundMoney(Math.max(Number(bookingProfile?.hourlyRate) || 0, 0));
    const hourlySubtotal = roundMoney(hourlyRate * billableHours);
    const subtotal = roundMoney(hourlySubtotal + safeReservationFee + safeServiceDogFee + airportFee);

    return {
      bookingType: normalizedBookingType,
      estimatedHours: billableHours,
      distanceCharge: 0,
      timeCharge: 0,
      reservationFee: safeReservationFee,
      serviceDogFee: safeServiceDogFee,
      hourlyRate,
      hourlySubtotal,
      subtotal,
      distanceMiles: Number(safeDistanceMiles.toFixed(3)),
      durationMinutes: Number((billableHours * 60).toFixed(2)),
    };
  }

  const distanceCharge = safeDistanceMiles * Number(categoryRate?.perMileRate || 0);
  const timeCharge = safeDurationMinutes * Number(categoryRate?.perMinuteRate || 0);
  const subtotal = roundMoney(
    Number(categoryRate?.baseFare || 0) + distanceCharge + timeCharge + safeReservationFee + safeServiceDogFee + airportFee
  );

  return {
    bookingType: normalizedBookingType,
    estimatedHours: null,
    distanceCharge: roundMoney(distanceCharge),
    timeCharge: roundMoney(timeCharge),
    reservationFee: safeReservationFee,
    serviceDogFee: safeServiceDogFee,
    hourlyRate: null,
    hourlySubtotal: null,
    subtotal,
    distanceMiles: Number(safeDistanceMiles.toFixed(3)),
    durationMinutes: Number(safeDurationMinutes.toFixed(2)),
  };
}

async function calculateTripFareFromMetrics(
  {
    distanceMiles,
    durationMinutes,
    surgeMultiplier = 1,
    pickup = null,
    dropoff = null,
    rideCategory = DEFAULT_RIDE_CATEGORY,
    bookingType = DEFAULT_BOOKING_TYPE,
    estimatedHours = null,
    serviceDogRequested = false,
  },
  configOverride = null
) {
  const config = await resolveSystemConfig(configOverride);

  const categoryRate = resolveCategoryRate(config.pricing, rideCategory);
  const categorySurgeProfile = resolveCategorySurgeProfile(config.surge, categoryRate.rideCategory);
  const bookingProfile = resolveCategoryBookingProfile(config.pricing, categoryRate.rideCategory);
  const commissionRate = Number(config.pricing.platformCommissionRate);
  const currency = config.pricing.currency || FALLBACK_CONFIG.pricing.currency;
  const normalizedBookingType = normalizeBookingType(bookingType, DEFAULT_BOOKING_TYPE);

  const safeDistanceMiles = Math.max(Number(distanceMiles) || 0, 0);
  const safeDurationMinutes = Math.max(Number(durationMinutes) || 0, 0);
  const safeSurgeMultiplier = clamp(
    Number(surgeMultiplier) || 1,
    1,
    Number(categorySurgeProfile.maxMultiplier) || FALLBACK_CONFIG.surge.maxMultiplier
  );

  const airportFeeDetails = calculateAirportFeeDetails({ pickup, dropoff });
  const bookingBreakdown = calculateBookingBreakdown({
    bookingType: normalizedBookingType,
    serviceDogRequested,
    distanceMiles: safeDistanceMiles,
    durationMinutes: safeDurationMinutes,
    estimatedHours,
    categoryRate,
    bookingProfile,
    airportFee: airportFeeDetails.totalAirportFee,
  });

  const subtotal = bookingBreakdown.subtotal;
  const totalFare = roundMoney(subtotal * safeSurgeMultiplier);
  const payout = calculatePayoutFromFare(totalFare, Number.isFinite(commissionRate) ? commissionRate : null);

  return {
    rideCategory: categoryRate.rideCategory,
    bookingType: bookingBreakdown.bookingType,
    serviceDogRequested: Boolean(serviceDogRequested),
    currency,
    baseFare: roundMoney(categoryRate.baseFare),
    perMileRate: roundMoney(categoryRate.perMileRate),
    perMinuteRate: roundMoney(categoryRate.perMinuteRate),
    estimatedHours: bookingBreakdown.estimatedHours,
    distanceMiles: bookingBreakdown.distanceMiles,
    durationMinutes: bookingBreakdown.durationMinutes,
    distanceCharge: bookingBreakdown.distanceCharge,
    timeCharge: bookingBreakdown.timeCharge,
    reservationFee: bookingBreakdown.reservationFee,
    serviceDogFee: bookingBreakdown.serviceDogFee,
    hourlyRate: bookingBreakdown.hourlyRate,
    hourlySubtotal: bookingBreakdown.hourlySubtotal,
    airportFee: airportFeeDetails.totalAirportFee,
    airportFeeDetails,
    subtotal,
    surgeMultiplier: Number(safeSurgeMultiplier.toFixed(2)),
    totalFare,
    platformCommission: payout.platformCommission,
    platformCommissionRate: payout.platformCommissionRate,
    platformSharePercent: Number((payout.platformCommissionRate * 100).toFixed(1)),
    driverEarnings: payout.driverEarnings,
    driverPayoutRate: payout.driverPayoutRate,
    driverSharePercent: Number((payout.driverPayoutRate * 100).toFixed(1)),
    surgeProfile: {
      sensitivity: Number(categorySurgeProfile.sensitivity.toFixed(3)),
      maxMultiplier: Number(categorySurgeProfile.maxMultiplier.toFixed(2)),
    },
  };
}

async function getPricingConfig() {
  return resolveSystemConfig();
}

async function calculateUpfrontPricing(
  {
    pickup,
    dropoff,
    surgeRadiusKm,
    rideCategory = DEFAULT_RIDE_CATEGORY,
    bookingType = DEFAULT_BOOKING_TYPE,
    estimatedHours = null,
    scheduledAt = null,
    serviceDogRequested = false,
  },
  configOverride = null
) {
  const config = await resolveSystemConfig(configOverride);

  const categoryRate = resolveCategoryRate(config.pricing, rideCategory);
  const categorySurgeProfile = resolveCategorySurgeProfile(config.surge, categoryRate.rideCategory);
  const bookingProfile = resolveCategoryBookingProfile(config.pricing, categoryRate.rideCategory);
  const averageSpeedMph = Number(config.pricing.averageSpeedMph) || FALLBACK_CONFIG.pricing.averageSpeedMph;
  const commissionRate = Number(config.pricing.platformCommissionRate);
  const currency = config.pricing.currency || FALLBACK_CONFIG.pricing.currency;
  const normalizedBookingType = normalizeBookingType(bookingType, DEFAULT_BOOKING_TYPE);

  const normalizedPickup = normalizePoint(pickup, 'pickup');
  const normalizedDropoff = normalizePoint(dropoff, 'dropoff');

  const distanceKm = haversineDistanceKm(normalizedPickup, normalizedDropoff);
  const distanceMiles = kmToMiles(distanceKm);
  const durationMinutes = estimateDurationMinutes(distanceMiles, averageSpeedMph);

  const airportFeeDetails = calculateAirportFeeDetails({
    pickup: normalizedPickup,
    dropoff: normalizedDropoff,
  });

  const bookingBreakdown = calculateBookingBreakdown({
    bookingType: normalizedBookingType,
    serviceDogRequested,
    distanceMiles,
    durationMinutes,
    estimatedHours,
    categoryRate,
    bookingProfile,
    airportFee: airportFeeDetails.totalAirportFee,
  });

  const subtotal = bookingBreakdown.subtotal;

  const demandMetrics = await getDemandMetrics(normalizedPickup, surgeRadiusKm, config.surge);
  const surgeMultiplier = calculateSurgeMultiplier(demandMetrics.demandRatio, categorySurgeProfile);
  const upfrontFare = roundMoney(subtotal * surgeMultiplier);
  const payout = calculatePayoutFromFare(upfrontFare, Number.isFinite(commissionRate) ? commissionRate : null);

  return {
    pickup: normalizedPickup,
    dropoff: normalizedDropoff,
    rideCategory: categoryRate.rideCategory,
    bookingType: bookingBreakdown.bookingType,
    serviceDogRequested: Boolean(serviceDogRequested),
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    currency,
    distanceKm: Number(distanceKm.toFixed(3)),
    distanceMiles: bookingBreakdown.distanceMiles,
    durationMinutes: bookingBreakdown.durationMinutes,
    estimatedHours: bookingBreakdown.estimatedHours,
    baseFare: roundMoney(categoryRate.baseFare),
    perMileRate: roundMoney(categoryRate.perMileRate),
    perMinuteRate: roundMoney(categoryRate.perMinuteRate),
    distanceCharge: bookingBreakdown.distanceCharge,
    timeCharge: bookingBreakdown.timeCharge,
    reservationFee: bookingBreakdown.reservationFee,
    serviceDogFee: bookingBreakdown.serviceDogFee,
    hourlyRate: bookingBreakdown.hourlyRate,
    hourlySubtotal: bookingBreakdown.hourlySubtotal,
    airportFee: airportFeeDetails.totalAirportFee,
    airportFeeDetails,
    subtotal,
    surgeMultiplier,
    demandRatio: demandMetrics.demandRatio,
    demandCount: demandMetrics.demandCount,
    supplyCount: demandMetrics.supplyCount,
    surgeRadiusKm: demandMetrics.radiusKm,
    surgeProfile: {
      sensitivity: Number(categorySurgeProfile.sensitivity.toFixed(3)),
      maxMultiplier: Number(categorySurgeProfile.maxMultiplier.toFixed(2)),
    },
    surgeTransparency: buildSurgeTransparency(demandMetrics, categorySurgeProfile, surgeMultiplier),
    upfrontFare,
    platformCommission: payout.platformCommission,
    platformCommissionRate: payout.platformCommissionRate,
    platformSharePercent: Number((payout.platformCommissionRate * 100).toFixed(1)),
    driverEarnings: payout.driverEarnings,
    driverPayoutRate: payout.driverPayoutRate,
    driverSharePercent: Number((payout.driverPayoutRate * 100).toFixed(1)),
  };
}

async function getSurgeVisibilityForLocation(
  { latitude, longitude, surgeRadiusKm, rideCategory = DEFAULT_RIDE_CATEGORY },
  configOverride = null
) {
  const config = await resolveSystemConfig(configOverride);

  const location = normalizePoint(
    {
      latitude,
      longitude,
    },
    'location'
  );

  const demandMetrics = await getDemandMetrics(location, surgeRadiusKm, config.surge);
  const selectedRideCategory = normalizeRideCategory(rideCategory, DEFAULT_RIDE_CATEGORY);
  const trend = deriveSurgeTrend(demandMetrics.demandRatio);

  const categories = RIDE_CATEGORIES.reduce((result, category) => {
    const categorySurgeProfile = resolveCategorySurgeProfile(config.surge, category);
    const surgeMultiplier = calculateSurgeMultiplier(demandMetrics.demandRatio, categorySurgeProfile);

    result[category] = {
      surgeMultiplier,
      sensitivity: Number(categorySurgeProfile.sensitivity.toFixed(3)),
      maxMultiplier: Number(categorySurgeProfile.maxMultiplier.toFixed(2)),
      trend,
      forecast: buildSurgeForecast(surgeMultiplier, demandMetrics.demandRatio, categorySurgeProfile.maxMultiplier),
      transparency: buildSurgeTransparency(demandMetrics, categorySurgeProfile, surgeMultiplier),
    };

    return result;
  }, {});

  const selectedCategoryData = categories[selectedRideCategory] || categories[DEFAULT_RIDE_CATEGORY];

  return {
    location,
    rideCategory: selectedRideCategory,
    surgeMultiplier: selectedCategoryData.surgeMultiplier,
    sensitivity: selectedCategoryData.sensitivity,
    maxMultiplier: selectedCategoryData.maxMultiplier,
    demandRatio: demandMetrics.demandRatio,
    demandCount: demandMetrics.demandCount,
    supplyCount: demandMetrics.supplyCount,
    surgeRadiusKm: demandMetrics.radiusKm,
    trend,
    forecast: selectedCategoryData.forecast,
    transparency: selectedCategoryData.transparency,
    categories,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  RIDE_CATEGORIES,
  DEFAULT_RIDE_CATEGORY,
  normalizeRideCategory,
  calculateUpfrontPricing,
  calculatePayoutFromFare,
  calculateTripFareFromMetrics,
  getPricingConfig,
  getSurgeVisibilityForLocation,
};
