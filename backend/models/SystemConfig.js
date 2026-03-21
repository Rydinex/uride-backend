const mongoose = require('mongoose');

const CategoryRateSchema = new mongoose.Schema(
  {
    baseFare: { type: Number, default: 0 },
    perMileRate: { type: Number, default: 0 },
    perMinuteRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const HourlyCategoryRateSchema = new mongoose.Schema(
  {
    hourlyRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const BookingDefaultsSchema = new mongoose.Schema(
  {
    reservationFee: { type: Number, default: 0 },
    serviceDogFee: { type: Number, default: 0 },
    minimumHourlyHours: { type: Number, default: 2 },
    categoryHourlyRates: {
      rydinex_regular: {
        type: HourlyCategoryRateSchema,
        default: () => ({
          hourlyRate: 45,
        }),
      },
      rydinex_comfort: {
        type: HourlyCategoryRateSchema,
        default: () => ({
          hourlyRate: 58,
        }),
      },
      rydinex_xl: {
        type: HourlyCategoryRateSchema,
        default: () => ({
          hourlyRate: 74,
        }),
      },
      rydinex_green: {
        type: HourlyCategoryRateSchema,
        default: () => ({
          hourlyRate: 49,
        }),
      },
      black_car: {
        type: HourlyCategoryRateSchema,
        default: undefined,
      },
      black_suv: {
        type: HourlyCategoryRateSchema,
        default: undefined,
      },
      suv: {
        type: HourlyCategoryRateSchema,
        default: undefined,
      },
    },
  },
  { _id: false }
);

const SurgeCategoryProfileSchema = new mongoose.Schema(
  {
    sensitivity: { type: Number, default: 0.7 },
    maxMultiplier: { type: Number, default: 3 },
  },
  { _id: false }
);

const PricingConfigSchema = new mongoose.Schema(
  {
    baseFare: { type: Number, default: 2.5 },
    perMileRate: { type: Number, default: 1.3 },
    perMinuteRate: { type: Number, default: 0.32 },
    averageSpeedMph: { type: Number, default: 20 },
    currency: { type: String, default: 'USD', trim: true },
    platformCommissionRate: { type: Number, default: 0.3 },
    categoryRates: {
      rydinex_regular: {
        type: CategoryRateSchema,
        default: () => ({
          baseFare: 2.5,
          perMileRate: 1.3,
          perMinuteRate: 0.32,
        }),
      },
      rydinex_comfort: {
        type: CategoryRateSchema,
        default: () => ({
          baseFare: 3.85,
          perMileRate: 1.55,
          perMinuteRate: 0.38,
        }),
      },
      rydinex_xl: {
        type: CategoryRateSchema,
        default: () => ({
          baseFare: 5.6,
          perMileRate: 2.05,
          perMinuteRate: 0.47,
        }),
      },
      rydinex_green: {
        type: CategoryRateSchema,
        default: () => ({
          baseFare: 2.85,
          perMileRate: 1.35,
          perMinuteRate: 0.34,
        }),
      },
      black_car: {
        type: CategoryRateSchema,
        default: undefined,
      },
      black_suv: {
        type: CategoryRateSchema,
        default: undefined,
      },
      suv: {
        type: CategoryRateSchema,
        default: undefined,
      },
    },
    bookingDefaults: {
      type: BookingDefaultsSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

const SurgeConfigSchema = new mongoose.Schema(
  {
    demandRadiusKm: { type: Number, default: 5 },
    sensitivity: { type: Number, default: 0.7 },
    maxMultiplier: { type: Number, default: 2.8 },
    categoryMultipliers: {
      rydinex_regular: {
        type: SurgeCategoryProfileSchema,
        default: () => ({
          sensitivity: 0.7,
          maxMultiplier: 2.8,
        }),
      },
      rydinex_comfort: {
        type: SurgeCategoryProfileSchema,
        default: () => ({
          sensitivity: 0.78,
          maxMultiplier: 3,
        }),
      },
      rydinex_xl: {
        type: SurgeCategoryProfileSchema,
        default: () => ({
          sensitivity: 0.86,
          maxMultiplier: 3.4,
        }),
      },
      rydinex_green: {
        type: SurgeCategoryProfileSchema,
        default: () => ({
          sensitivity: 0.72,
          maxMultiplier: 2.9,
        }),
      },
      black_car: {
        type: SurgeCategoryProfileSchema,
        default: undefined,
      },
      black_suv: {
        type: SurgeCategoryProfileSchema,
        default: undefined,
      },
      suv: {
        type: SurgeCategoryProfileSchema,
        default: undefined,
      },
    },
  },
  { _id: false }
);

const SystemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: 'global',
      trim: true,
    },
    pricing: {
      type: PricingConfigSchema,
      default: () => ({}),
    },
    surge: {
      type: SurgeConfigSchema,
      default: () => ({}),
    },
    updatedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
