const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    accuracy: {
      type: Number,
      default: null,
    },
    speed: {
      type: Number,
      default: 0,
    },
    heading: {
      type: Number,
      default: null,
    },
    altitude: {
      type: Number,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

// Geospatial index for distance queries
locationHistorySchema.index({ latitude: 1, longitude: 1 });
locationHistorySchema.index({ tripId: 1, timestamp: 1 });
locationHistorySchema.index({ driverId: 1, timestamp: 1 });

// TTL index: auto-delete after 30 days
locationHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('LocationHistory', locationHistorySchema);
