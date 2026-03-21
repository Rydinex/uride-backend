const mongoose = require('mongoose');

const geocodeSchema = new mongoose.Schema(
  {
    // Original query
    query: String, // Either address or coordinates
    queryType: {
      type: String,
      enum: ['address', 'coordinates'],
      required: true,
    },

    // Address information
    address: {
      fullAddress: String,
      street: String,
      housenumber: String,
      city: String,
      state: String,
      postcode: String,
      country: String,
    },

    // Coordinates
    latitude: Number,
    longitude: Number,

    // Geocoding metadata
    displayName: String, // Human-readable address from Nominatim
    placeId: Number, // Nominatim place ID
    osmType: String, // 'N' (node), 'W' (way), 'R' (relation)
    osmId: Number,
    boundingBox: {
      north: Number,
      south: Number,
      east: Number,
      west: Number,
    },

    // Place classification
    addressType: String, // 'residential', 'commercial', 'amenity', etc.
    category: String, // 'place', 'building', 'amenity', etc.
    type: String, // Specific type

    // Quality metrics
    importance: Number, // 0-1 importance score from Nominatim
    accuracy: {
      type: String,
      enum: ['exact', 'high', 'medium', 'low'],
      default: 'medium',
    },

    // Usage tracking
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    usageCount: {
      type: Number,
      default: 1,
    },
    lastUsed: Date,

    // Caching
    provider: {
      type: String,
      enum: ['nominatim', 'pelias', 'cache'],
      default: 'nominatim',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      index: true,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient searches
geocodeSchema.index({ address: 1 });
geocodeSchema.index({ latitude: 1, longitude: 1 });
geocodeSchema.index({ placeId: 1 });
geocodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Geocode', geocodeSchema);
