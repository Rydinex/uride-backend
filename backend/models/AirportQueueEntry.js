const mongoose = require('mongoose');

const AirportQueueLocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const AirportQueueEntrySchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    airportCode: {
      type: String,
      enum: ['ORD', 'MDW', null],
      default: null,
      index: true,
    },
    queueType: {
      type: String,
      enum: ['airport', 'event'],
      default: 'airport',
      index: true,
    },
    queueGroup: {
      type: String,
      enum: ['regular', 'black_car'],
      default: 'regular',
      index: true,
    },
    eventCode: {
      type: String,
      enum: ['UNITED_CENTER', 'WRIGLEY_FIELD', 'SOLDIER_FIELD', null],
      default: null,
      index: true,
    },
    lotCode: {
      type: String,
      default: null,
      trim: true,
    },
    stagingAreaCode: {
      type: String,
      default: null,
      trim: true,
    },
    pickupZoneCode: {
      type: String,
      default: null,
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'assigned', 'exited'],
      default: 'waiting',
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    assignedTrip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    exitedAt: {
      type: Date,
      default: null,
    },
    exitReason: {
      type: String,
      default: null,
      trim: true,
    },
    lastKnownLocation: {
      type: AirportQueueLocationSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

AirportQueueEntrySchema.index({ airportCode: 1, status: 1, joinedAt: 1 });
AirportQueueEntrySchema.index({ queueType: 1, queueGroup: 1, status: 1, joinedAt: 1 });
AirportQueueEntrySchema.index({ queueType: 1, eventCode: 1, queueGroup: 1, status: 1, joinedAt: 1 });

module.exports = mongoose.model('AirportQueueEntry', AirportQueueEntrySchema);
