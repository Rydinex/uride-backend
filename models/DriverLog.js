const mongoose = require('mongoose');

const DriverLogSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
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
      enum: ['system', 'driver', 'admin'],
      default: 'system',
      index: true,
    },
    actorId: {
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

DriverLogSchema.index({ driver: 1, occurredAt: -1 });

module.exports = mongoose.model('DriverLog', DriverLogSchema);
