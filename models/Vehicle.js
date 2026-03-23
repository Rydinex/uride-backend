const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      unique: true,
    },
    make: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
    },
    plateNumber: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
      default: '',
    },

    // ⭐ NEW FIELD: determines pricing + trip assignment
    rideCategory: {
      type: String,
      enum: [
        'rydine_regular',
        'rydine_comfort',
        'rydine_xl',
        'rydine_green',
        'black_car',
        'black_suv'
      ],
      required: true,
      trim: true,
      lowercase: true,
    },

    powertrain: {
      type: String,
      enum: ['gasoline', 'diesel', 'hybrid', 'electric'],
      default: 'gasoline',
      trim: true,
      lowercase: true,
    },
    photoUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Vehicle', VehicleSchema);
