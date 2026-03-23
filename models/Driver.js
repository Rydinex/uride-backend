const mongoose = require('mongoose');

const DriverDocumentSchema = new mongoose.Schema(
  {
    docType: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const ChauffeurLicenseSchema = new mongoose.Schema(
  {
    licenseNumber: {
      type: String,
      default: null,
      trim: true,
    },
    issuingState: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    verificationNotes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const VehicleInspectionSchema = new mongoose.Schema(
  {
    reportUrl: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['not_uploaded', 'pending', 'approved', 'rejected'],
      default: 'not_uploaded',
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    inspectionCenter: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const DriverTripPreferencesSchema = new mongoose.Schema(
  {
    serviceDogEnabled: {
      type: Boolean,
      default: true,
    },
    teenPickupEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const DriverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },

    // ⭐ NEW FIELD: Standard vs Professional Chauffeur
    driverType: {
      type: String,
      enum: ['standard', 'professional'],
      required: true,
      default: 'standard',
    },

    docs: {
      type: [DriverDocumentSchema],
      default: [],
    },

    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },

    operatingStates: {
      type: [String],
      default: ['IL'],
    },

    chauffeurLicense: {
      type: ChauffeurLicenseSchema,
      default: () => ({
        status: 'unverified',
      }),
    },

    vehicleInspection: {
      type: VehicleInspectionSchema,
      default: () => ({
        status: 'not_uploaded',
      }),
    },

    tripPreferences: {
      type: DriverTripPreferencesSchema,
      default: () => ({
        serviceDogEnabled: true,
        teenPickupEnabled: false,
      }),
    },

    canAccessAirport: {
      type: Boolean,
      default: false,
    },

    airportQueueStatus: {
      type: String,
      enum: ['none', 'queued', 'assigned'],
      default: 'none',
    },

    airportQueueEnteredAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },

    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Driver', DriverSchema);