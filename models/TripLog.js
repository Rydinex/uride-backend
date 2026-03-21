const mongoose = require('mongoose');

const TripLogSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      default: null,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    actorType: {
      type: String,
      enum: ['system', 'rider', 'driver', 'admin'],
      default: 'system',
      index: true,
    },
    actorId: {
      type: String,
      default: null,
      trim: true,
    },
    statusFrom: {
      type: String,
      default: null,
      trim: true,
    },
    statusTo: {
      type: String,
      default: null,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TripLogSchema.index({ trip: 1, occurredAt: -1 });

module.exports = mongoose.model('TripLog', TripLogSchema);
