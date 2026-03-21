const mongoose = require('mongoose');

const trafficSchema = new mongoose.Schema(
  {
    // Road segment identifier
    roadSegment: {
      startLatitude: Number,
      startLongitude: Number,
      endLatitude: Number,
      endLongitude: Number,
      osmWayId: Number, // OpenStreetMap way ID
      roadName: String,
      roadType: {
        type: String,
        enum: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified'],
        default: 'residential',
      },
      speedLimit: Number, // km/h
    },

    // Current traffic state
    currentSpeed: {
      type: Number,
      default: 0, // km/h (average from recent vehicles)
    },
    averageSpeed: Number, // Historical average
    maxSpeed: Number, // Max recorded today
    minSpeed: Number, // Min recorded today

    // Congestion metrics
    congestionLevel: {
      type: String,
      enum: ['free_flow', 'light', 'moderate', 'heavy', 'severe'],
      default: 'free_flow',
    },
    congestionScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    }, // 0 = free flow, 100 = completely stopped
    speedPercentage: Number, // Current speed as % of speed limit

    // Data collection
    sampleCount: {
      type: Number,
      default: 0,
    }, // How many vehicles contributed to this data
    lastUpdate: {
      type: Date,
      default: Date.now,
    },
    dataPoints: [
      {
        speed: Number, // km/h
        timestamp: Date,
        driverId: mongoose.Schema.Types.ObjectId,
        accuracy: Number, // Confidence in measurement
      },
    ],

    // Time-based patterns
    peakHours: [
      {
        hour: Number, // 0-23
        averageSpeed: Number,
        congestionLevel: String,
        frequency: Number, // How often this pattern appears
      },
    ],

    // Historical data (for patterns)
    historicalData: {
      hourly: [
        {
          hour: Number,
          averageSpeed: Number,
          congestionLevel: String,
        },
      ],
      daily: [
        {
          dayOfWeek: Number, // 0-6
          averageSpeed: Number,
          peakHours: [Number],
        },
      ],
    },

    // Incidents
    incidents: [
      {
        type: {
          type: String,
          enum: ['accident', 'construction', 'event', 'weather', 'disabled_vehicle', 'other'],
        },
        description: String,
        severity: {
          type: String,
          enum: ['minor', 'moderate', 'severe'],
        },
        reportedBy: mongoose.Schema.Types.ObjectId,
        timestamp: Date,
        resolvedAt: Date,
        affectedArea: {
          latitude: Number,
          longitude: Number,
          radius: Number, // meters
        },
      },
    ],

    // ETA impact
    etaImpact: {
      normalDuration: Number, // seconds (speed limit speed)
      estimatedDuration: Number, // seconds (current speed)
      delaySeconds: Number,
      delayPercentage: Number,
    },

    // Metrics
    lastHourAverageSpeed: Number,
    last24HourAverageSpeed: Number,
    trend: {
      type: String,
      enum: ['improving', 'stable', 'degrading'],
      default: 'stable',
    },

    // Spatial info
    coordinates: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },

    // TTL - keep only recent data
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      index: true,
    },

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

// Geospatial index for traffic heatmaps
trafficSchema.index({ 'coordinates': '2dsphere' });
// Road segment index
trafficSchema.index({ 'roadSegment.osmWayId': 1 });
// Time index
trafficSchema.index({ lastUpdate: -1 });
// TTL index
trafficSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Traffic', trafficSchema);
