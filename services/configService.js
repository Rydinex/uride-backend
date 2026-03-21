const SystemConfig = require('../models/SystemConfig');

const RIDE_CATEGORIES = ['rydinex_regular', 'rydinex_comfort', 'rydinex_xl', 'rydinex_green'];
const DEFAULT_RIDE_CATEGORY = 'rydinex_regular';
const RIDE_CATEGORY_ALIASES = {
  regular: 'rydinex_regular',
  comfort: 'rydinex_comfort',
  xl: 'rydinex_xl',
  green: 'rydinex_green',
  black_car: 'rydinex_comfort',
  black_suv: 'rydinex_xl',
  suv: 'rydinex_xl',
  rydnex_xl: 'rydinex_xl',
};

const CATEGORY_INPUT_ALIASES = {
  rydinex_regular: ['rydinex_regular', 'regular'],
  rydinex_comfort: ['rydinex_comfort', 'comfort', 'black_car'],
  rydinex_xl: ['rydinex_xl', 'xl', 'black_suv', 'suv', 'rydnex_xl'],
  rydinex_green: ['rydinex_green', 'green'],
};

const PREMIUM_RIDE_INPUT_ALIASES = ['black_car', 'black_suv', 'suv'];
const PREMIUM_NORMALIZED_RIDE_CATEGORIES = ['rydinex_comfort', 'rydinex_xl'];

function normalizeRideCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (RIDE_CATEGORY_ALIASES[normalized]) {
    return RIDE_CATEGORY_ALIASES[normalized];
  }

  if (RIDE_CATEGORIES.includes(normalized)) {
    return normalized;
  }

  return null;
}

function isPremiumRideCategory(value) {
  const rawInput = String(value || '').trim().toLowerCase();
  if (PREMIUM_RIDE_INPUT_ALIASES.includes(rawInput)) {
    return true;
  }

  const normalized = normalizeRideCategory(value);
  return PREMIUM_NORMALIZED_RIDE_CATEGORIES.includes(normalized);
}

const DEFAULT_CONFIG = {
  pricing: {
    baseFare: Number(process.env.PRICING_BASE_FARE || 2.5),
    perMileRate: Number(process.env.PRICING_PER_MILE_RATE || 1.3),
    perMinuteRate: Number(process.env.PRICING_PER_MINUTE_RATE || 0.32),
    averageSpeedMph: Number(process.env.PRICING_AVERAGE_SPEED_MPH || 20),
    currency: process.env.PRICING_CURRENCY || 'USD',
    platformCommissionRate: Number(process.env.PLATFORM_COMMISSION_RATE || 0.3),
    categoryRates: {
      rydinex_regular: {
        baseFare: Number(process.env.PRICING_RYDINEX_REGULAR_BASE_FARE || 2.5),
        perMinuteRate: Number(process.env.PRICING_RYDINEX_REGULAR_PER_MINUTE || 0.32),
        perMileRate: Number(process.env.PRICING_RYDINEX_REGULAR_PER_MILE || 1.3),
      },
      rydinex_comfort: {
        baseFare: Number(process.env.PRICING_RYDINEX_COMFORT_BASE_FARE || 3.85),
        perMinuteRate: Number(process.env.PRICING_RYDINEX_COMFORT_PER_MINUTE || 0.38),
        perMileRate: Number(process.env.PRICING_RYDINEX_COMFORT_PER_MILE || 1.55),
      },
      rydinex_xl: {
        baseFare: Number(process.env.PRICING_RYDINEX_XL_BASE_FARE || 5.6),
        perMinuteRate: Number(process.env.PRICING_RYDINEX_XL_PER_MINUTE || 0.47),
        perMileRate: Number(process.env.PRICING_RYDINEX_XL_PER_MILE || 2.05),
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
          hourlyRate: Number(process.env.PRICING_RYDINEX_COMFORT_HOURLY_RATE || 58),
        },
        rydinex_xl: {
          hourlyRate: Number(process.env.PRICING_RYDINEX_XL_HOURLY_RATE || 74),
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
        sensitivity: Number(process.env.SURGE_RYDINEX_COMFORT_SENSITIVITY || 0.78),
        maxMultiplier: Number(process.env.SURGE_RYDINEX_COMFORT_MAX_MULTIPLIER || 3),
      },
      rydinex_xl: {
        sensitivity: Number(process.env.SURGE_RYDINEX_XL_SENSITIVITY || 0.86),
        maxMultiplier: Number(process.env.SURGE_RYDINEX_XL_MAX_MULTIPLIER || 3.4),
      },
      rydinex_green: {
        sensitivity: Number(process.env.SURGE_RYDINEX_GREEN_SENSITIVITY || 0.72),
        maxMultiplier: Number(process.env.SURGE_RYDINEX_GREEN_MAX_MULTIPLIER || 2.9),
      },
    },
  },
};

function toFiniteNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCategoryInput(source, category) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const aliasKeys = CATEGORY_INPUT_ALIASES[category] || [category];

  for (const key of aliasKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }

  return null;
}

function normalizePricingPayload(payload = {}) {
  const categoryRates = {};
  const bookingDefaults = {};

  if (payload.bookingDefaults && typeof payload.bookingDefaults === 'object') {
    const categoryHourlyRates = {};

    if (payload.bookingDefaults.categoryHourlyRates && typeof payload.bookingDefaults.categoryHourlyRates === 'object') {
      RIDE_CATEGORIES.forEach(category => {
        const categoryInput = getCategoryInput(payload.bookingDefaults.categoryHourlyRates, category);
        if (!categoryInput || typeof categoryInput !== 'object') {
          return;
        }

        const hourlyRate = toFiniteNumber(categoryInput.hourlyRate);
        if (hourlyRate !== null) {
          categoryHourlyRates[category] = {
            hourlyRate: Math.max(0, Number(hourlyRate)),
          };
        }
      });
    }

    const reservationFee = toFiniteNumber(payload.bookingDefaults.reservationFee);
    if (reservationFee !== null) {
      bookingDefaults.reservationFee = Math.max(0, Number(reservationFee));
    }

    const serviceDogFee = toFiniteNumber(payload.bookingDefaults.serviceDogFee);
    if (serviceDogFee !== null) {
      bookingDefaults.serviceDogFee = Math.max(0, Number(serviceDogFee));
    }

    const minimumHourlyHours = toFiniteNumber(payload.bookingDefaults.minimumHourlyHours);
    if (minimumHourlyHours !== null) {
      bookingDefaults.minimumHourlyHours = Math.max(1, Number(minimumHourlyHours));
    }

    if (Object.keys(categoryHourlyRates).length) {
      bookingDefaults.categoryHourlyRates = categoryHourlyRates;
    }
  }

  if (payload.categoryRates && typeof payload.categoryRates === 'object') {
    RIDE_CATEGORIES.forEach(category => {
      const inputRate = getCategoryInput(payload.categoryRates, category);
      if (!inputRate || typeof inputRate !== 'object') {
        return;
      }

      const normalizedRate = {
        ...(toFiniteNumber(inputRate.baseFare) !== null ? { baseFare: Math.max(0, Number(inputRate.baseFare)) } : {}),
        ...(toFiniteNumber(inputRate.perMileRate) !== null ? { perMileRate: Math.max(0, Number(inputRate.perMileRate)) } : {}),
        ...(toFiniteNumber(inputRate.perMinuteRate) !== null ? { perMinuteRate: Math.max(0, Number(inputRate.perMinuteRate)) } : {}),
      };

      if (Object.keys(normalizedRate).length) {
        categoryRates[category] = normalizedRate;
      }
    });
  }

  return {
    ...(toFiniteNumber(payload.baseFare) !== null ? { baseFare: Math.max(0, Number(payload.baseFare)) } : {}),
    ...(toFiniteNumber(payload.perMileRate) !== null ? { perMileRate: Math.max(0, Number(payload.perMileRate)) } : {}),
    ...(toFiniteNumber(payload.perMinuteRate) !== null ? { perMinuteRate: Math.max(0, Number(payload.perMinuteRate)) } : {}),
    ...(toFiniteNumber(payload.averageSpeedMph) !== null ? { averageSpeedMph: Math.max(5, Number(payload.averageSpeedMph)) } : {}),
    ...(typeof payload.currency === 'string' && payload.currency.trim() ? { currency: payload.currency.trim().toUpperCase() } : {}),
    ...(toFiniteNumber(payload.platformCommissionRate) !== null
      ? { platformCommissionRate: Math.min(Math.max(Number(payload.platformCommissionRate), 0), 0.9) }
      : {}),
    ...(Object.keys(categoryRates).length ? { categoryRates } : {}),
    ...(Object.keys(bookingDefaults).length ? { bookingDefaults } : {}),
  };
}

function normalizeSurgePayload(payload = {}) {
  const categoryMultipliers = {};

  if (payload.categoryMultipliers && typeof payload.categoryMultipliers === 'object') {
    RIDE_CATEGORIES.forEach(category => {
      const inputProfile = getCategoryInput(payload.categoryMultipliers, category);
      if (!inputProfile || typeof inputProfile !== 'object') {
        return;
      }

      const normalizedProfile = {
        ...(toFiniteNumber(inputProfile.sensitivity) !== null ? { sensitivity: Math.max(0, Number(inputProfile.sensitivity)) } : {}),
        ...(toFiniteNumber(inputProfile.maxMultiplier) !== null ? { maxMultiplier: Math.max(1, Number(inputProfile.maxMultiplier)) } : {}),
      };

      if (Object.keys(normalizedProfile).length) {
        categoryMultipliers[category] = normalizedProfile;
      }
    });
  }

  return {
    ...(toFiniteNumber(payload.demandRadiusKm) !== null ? { demandRadiusKm: Math.max(0.5, Number(payload.demandRadiusKm)) } : {}),
    ...(toFiniteNumber(payload.sensitivity) !== null ? { sensitivity: Math.max(0, Number(payload.sensitivity)) } : {}),
    ...(toFiniteNumber(payload.maxMultiplier) !== null ? { maxMultiplier: Math.max(1, Number(payload.maxMultiplier)) } : {}),
    ...(Object.keys(categoryMultipliers).length ? { categoryMultipliers } : {}),
  };
}

async function getOrCreateSystemConfig() {
  let config = await SystemConfig.findOne({ key: 'global' });

  if (!config) {
    config = await SystemConfig.create({
      key: 'global',
      pricing: DEFAULT_CONFIG.pricing,
      surge: DEFAULT_CONFIG.surge,
      updatedBy: 'system',
    });
  }

  return config;
}

async function getEffectiveSystemConfig() {
  const config = await getOrCreateSystemConfig();

  return {
    pricing: {
      ...DEFAULT_CONFIG.pricing,
      ...(config.pricing?.toObject ? config.pricing.toObject() : config.pricing || {}),
    },
    surge: {
      ...DEFAULT_CONFIG.surge,
      ...(config.surge?.toObject ? config.surge.toObject() : config.surge || {}),
    },
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  };
}

async function updatePricingConfig(payload, updatedBy = 'admin') {
  const config = await getOrCreateSystemConfig();
  const normalized = normalizePricingPayload(payload);

  config.pricing = {
    ...(config.pricing?.toObject ? config.pricing.toObject() : config.pricing || {}),
    ...normalized,
  };
  config.updatedBy = updatedBy;

  await config.save();
  return getEffectiveSystemConfig();
}

async function updateSurgeConfig(payload, updatedBy = 'admin') {
  const config = await getOrCreateSystemConfig();
  const normalized = normalizeSurgePayload(payload);

  config.surge = {
    ...(config.surge?.toObject ? config.surge.toObject() : config.surge || {}),
    ...normalized,
  };
  config.updatedBy = updatedBy;

  await config.save();
  return getEffectiveSystemConfig();
}

module.exports = {
  RIDE_CATEGORIES,
  DEFAULT_RIDE_CATEGORY,
  RIDE_CATEGORY_ALIASES,
  CATEGORY_INPUT_ALIASES,
  PREMIUM_RIDE_INPUT_ALIASES,
  PREMIUM_NORMALIZED_RIDE_CATEGORIES,
  normalizeRideCategory,
  isPremiumRideCategory,
  DEFAULT_CONFIG,
  getEffectiveSystemConfig,
  updatePricingConfig,
  updateSurgeConfig,
};
