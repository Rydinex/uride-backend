const mongoose = require('mongoose');

const PaymentLogSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      default: null,
    },
    provider: {
      type: String,
      default: 'stripe',
    },
    event: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'success',
    },
    paymentMethodId: {
      type: String,
      default: null,
    },
    customerId: {
      type: String,
      default: null,
    },
    connectAccountId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: 'usd',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PaymentLog', PaymentLogSchema);
