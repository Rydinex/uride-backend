const mongoose = require('mongoose');

const poiSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'restaurant',
        'gas_station',
        'hospital',
        'hotel',
        'pharmacy',
        'atm',
        'parking',
        'car_wash',
        'bank',
        'grocery',
        'charging_station',
        'emergency',
        'cafe',
        'bar',
        'other',
      ],
      required: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    // Geospatial index for proximity queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    address: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      default: null,
    },
    website: {
      type: String,
      default: null,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    operatingHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String },
    },
    tags: [String], // e.g., ['wifi', 'outdoor_seating', 'parking']
    imageUrl: String,
    priceLevel: {
      type: Number,
      min: 1,
      max: 4,
      default: 2, // 1-4 scale ($-$$$$)
    },
    aiRelevanceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    /**
     * AI metadata for intelligent recommendations
     * - 'popular': trending among users
     * - 'recommended': high rating + good reviews
     * - 'new': recently added
     * - 'emergency': urgent services (hospital, police)
     */
    aiTags: [
      {
        type: String,
        enum: ['popular', 'recommended', 'new', 'emergency', 'budget-friendly', 'premium'],
      },
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    visits: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial index
poiSchema.index({ location: '2dsphere' });

// Create index for text search
poiSchema.index({ name: 'text', address: 'text', tags: 'text' });

// Create compound index for efficient queries
poiSchema.index({ category: 1, isOpen: 1, rating: -1 });
poiSchema.index({ category: 1, aiTags: 1 });

module.exports = mongoose.model('POI', poiSchema);
