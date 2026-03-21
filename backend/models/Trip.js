const mongoose = require('mongoose');

const TripPointSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: null,
      trim: true,
    },
    state: {
      type: String,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{2}$/,
      default: null,
    },
    country: {
      type: String,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{2}$/,
      default: null,
    },
  },
  { _id: false }
);

const StatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    actorType: {
      type: String,
      enum: ['system', 'rider', 'driver', 'admin'],
      default: 'system',
    },
    actorId: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const DeclineHistorySchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    reason: {
      type: String,
      default: 'Declined by driver',
      trim: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const RoutePointSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    speedKph: {
      type: Number,
      default: null,
    },
    heading: {
      type: Number,
      default: null,
    },
    accuracyMeters: {
      type: Number,
      default: null,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const TripSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      required: true,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
      index: true,
    },
    pickup: {
      type: TripPointSchema,
      required: true,
    },
    dropoff: {
      type: TripPointSchema,
      required: true,
    },
    pickupState: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      index: true,
    },
    pickupCountry: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      index: true,
    },
    pickupCity: {
      type: String,
      trim: true,
      default: null,
    },
    dropoffState: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      index: true,
    },
    dropoffCountry: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      index: true,
    },
    dropoffCity: {
      type: String,
      trim: true,
      default: null,
    },
    isPrearranged: {
      type: Boolean,
      default: false,
      index: true,
    },
    statePolicyVersion: {
      type: String,
      default: null,
      trim: true,
    },
    rideCategory: {
      type: String,
      enum: [
        'rydinex_regular',
        'rydinex_comfort',
        'rydinex_xl',
        'rydinex_green',
        'black_car',
        'black_suv',
        'suv',
      ],
      default: 'rydinex_regular',
      index: true,
    },
    bookingType: {
      type: String,
      enum: ['on_demand', 'reservation', 'hourly'],
      default: 'on_demand',
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },
    estimatedHours: {
      type: Number,
      default: null,
    },
    reservationFee: {
      type: Number,
      default: 0,
    },
    hourlyRate: {
      type: Number,
      default: null,
    },
    hourlySubtotal: {
      type: Number,
      default: null,
    },
    serviceDogRequested: {
      type: Boolean,
      default: false,
      index: true,
    },
    serviceDogFee: {
      type: Number,
      default: 0,
    },
    teenPickup: {
      type: Boolean,
      default: false,
      index: true,
    },
    teenSeatingPolicy: {
      type: String,
      enum: ['none', 'back_seat_only'],
      default: 'none',
    },
    specialInstructions: {
      type: String,
      default: '',
      trim: true,
    },
    distanceKmEstimate: {
      type: Number,
      default: null,
    },
    distanceMilesEstimate: {
      type: Number,
      default: null,
    },
    durationMinutesEstimate: {
      type: Number,
      default: null,
    },
    fareEstimate: {
      type: Number,
      default: null,
    },
    upfrontFare: {
      type: Number,
      default: null,
    },
    tipAmount: {
      type: Number,
      default: 0,
    },
    tipUpdatedAt: {
      type: Date,
      default: null,
    },
    riderOverallRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    riderProfessionalismRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    riderCarCleanlinessRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    riderAmenitiesRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    riderGreetingRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    riderFeedbackComment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    riderFeedbackSubmittedAt: {
      type: Date,
      default: null,
      index: true,
    },
    riderFeedbackUpdatedAt: {
      type: Date,
      default: null,
    },
    driverRiderOverallRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    driverRiderSafetyRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    driverRiderRespectRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5,
    },
    driverRiderFeedbackComment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    driverRiderFeedbackSubmittedAt: {
      type: Date,
      default: null,
      index: true,
    },
    driverRiderFeedbackUpdatedAt: {
      type: Date,
      default: null,
    },
    surgeMultiplier: {
      type: Number,
      default: 1,
    },
    demandRatio: {
      type: Number,
      default: 1,
    },
    platformCommission: {
      type: Number,
      default: null,
    },
    platformCommissionRate: {
      type: Number,
      default: null,
    },
    airportFee: {
      type: Number,
      default: 0,
    },
    airportPickupCode: {
      type: String,
      enum: ['ORD', 'MDW', null],
      default: null,
    },
    airportDropoffCode: {
      type: String,
      enum: ['ORD', 'MDW', null],
      default: null,
    },
    assignedFromAirportQueue: {
      type: Boolean,
      default: false,
    },
    queueType: {
      type: String,
      enum: ['airport', 'event', null],
      default: null,
    },
    queueGroup: {
      type: String,
      enum: ['regular', 'black_car', null],
      default: null,
    },
    queueAirportCode: {
      type: String,
      enum: ['ORD', 'MDW', null],
      default: null,
    },
    queueEventCode: {
      type: String,
      enum: ['UNITED_CENTER', 'WRIGLEY_FIELD', 'SOLDIER_FIELD', null],
      default: null,
    },
    queueEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AirportQueueEntry',
      default: null,
    },
    driverEarnings: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    pricingBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'scheduled',
        'searching',
        'driver_assigned',
        'driver_accepted',
        'driver_arrived_pickup',
        'in_progress',
        'completed',
        'cancelled',
        'no_driver',
      ],
      default: 'searching',
      index: true,
    },
    driverResponseDeadlineAt: {
      type: Date,
      default: null,
    },
    matchedAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
      trim: true,
    },
    actualDistanceKm: {
      type: Number,
      default: 0,
    },
    actualDistanceMiles: {
      type: Number,
      default: 0,
    },
    actualDurationMinutes: {
      type: Number,
      default: 0,
    },
    currentDriverLocation: {
      type: RoutePointSchema,
      default: null,
    },
    routePoints: {
      type: [RoutePointSchema],
      default: [],
    },
    receipt: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    declineHistory: {
      type: [DeclineHistorySchema],
      default: [],
    },
    statusHistory: {
      type: [StatusHistorySchema],
      default: [
        {
          status: 'searching',
          actorType: 'system',
          note: 'Trip created',
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Trip', TripSchema);
