const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
    },

    // Route waypoints
    waypoints: [
      {
        latitude: Number,
        longitude: Number,
        order: Number, // 0=pickup, 1+=dropoffs
        type: {
          type: String,
          enum: ['pickup', 'dropoff', 'waypoint'],
          default: 'waypoint',
        },
        address: String,
        arrivedAt: Date,
      },
    ],

    // Route geometry (encoded polyline)
    geometry: String, // Encoded polyline for efficient storage
    decodedGeometry: [
      {
        latitude: Number,
        longitude: Number,
      },
    ],

    // Route metrics
    totalDistance: Number, // in kilometers
    totalDuration: Number, // in seconds
    totalDurationMinutes: {
      type: Number,
      get: function () {
        return Math.round(this.totalDuration / 60);
      },
    },

    // Segment information
    segments: [
      {
        instruction: String,
        distance: Number, // meters
        duration: Number, // seconds
        direction: String, // e.g., "turn right", "continue straight"
        name: String, // street name
        bearing: Number, // compass bearing
        coordinates: [{ latitude: Number, longitude: Number }],
      },
    ],

    // ETA tracking
    eta: {
      originalEta: Date, // Original calculated ETA
      currentEta: Date, // Updated ETA based on actual progress
      estimatedArrivalTime: Number, // in seconds from now
    },

    // Current progress
    currentProgress: {
      currentSegmentIndex: {
        type: Number,
        default: 0,
      },
      currentWaypointIndex: {
        type: Number,
        default: 0,
      },
      distanceTraveled: Number, // meters
      durationTraveled: Number, // seconds
      remainingDistance: Number, // meters
      remainingDuration: Number, // seconds
    },

    // Optimization
    optimized: {
      type: Boolean,
      default: false,
    },
    optimizationReason: String, // e.g., "traffic", "user_request", "multi_stop"

    // Real-time updates
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPaused: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
    canceledAt: Date,

    // Metadata
    routingEngine: {
      type: String,
      enum: ['osrm', 'graphhopper', 'valhalla'],
      default: 'osrm',
    },
    profile: {
      type: String,
      enum: ['car', 'bike', 'foot'],
      default: 'car',
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
    toJSON: { getters: true },
  }
);

// Index for efficient queries
routeSchema.index({ tripId: 1, isActive: 1 });
routeSchema.index({ driverId: 1, createdAt: -1 });
routeSchema.index({ 'currentProgress.currentSegmentIndex': 1 });

module.exports = mongoose.model('Route', routeSchema);
