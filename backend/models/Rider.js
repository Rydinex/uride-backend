const mongoose = require('mongoose');

const PaymentMethodSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      default: 'stripe',
    },
    paymentMethodId: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      default: 'unknown',
    },
    last4: {
      type: String,
      default: '',
    },
    expMonth: {
      type: Number,
      default: null,
    },
    expYear: {
      type: Number,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const FavoriteLocationSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    placeType: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'other',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

const RiderSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeConnectAccountId: {
      type: String,
      default: null,
    },
    paymentMethods: {
      type: [PaymentMethodSchema],
      default: [],
    },
    favoriteLocations: {
      type: [FavoriteLocationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Rider', RiderSchema);
