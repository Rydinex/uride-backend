const mongoose = require('mongoose');

const rydinexMapSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['geofence', 'zone', 'hotspot', 'landmark'],
      default: 'zone',
    },
    center: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    radius: {
      type: Number,
      required: true,
    },
    description: String,
    metadata: {
      airportCode: String,
      zoneType: String,
      restrictions: [String],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  }
);

// Geospatial index
rydinexMapSchema.index({ 'center.latitude': 1, 'center.longitude': 1 });

module.exports = mongoose.model('RydinexMap', rydinexMapSchema);
