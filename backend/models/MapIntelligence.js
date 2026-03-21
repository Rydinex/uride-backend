const mongoose = require('mongoose');

const mapIntelligenceSchema = new mongoose.Schema(
  {
    // Road segment information
    roadSegment: {
      osmWayId: Number,
      roadName: String,
      roadType: {
        type: String,
        enum: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified'],
        default: 'residential',
      },
      speedLimit: Number, // km/h
      lanes: Number,
      oneWay: Boolean,
      hasBicyclePath: Boolean,
      hasWideShoulder: Boolean,
      isBridge: Boolean,
      isTunnel: Boolean,
    },

    // Terrain & elevation
    elevation: {
      startElevation: Number, // meters
      endElevation: Number,
      maxElevation: Number,
      grade: Number, // percentage (for trucks)
      terrain: {
        type: String,
        enum: ['flat', 'rolling', 'hilly', 'mountain', 'valley'],
        default: 'flat',
      },
    },

    // Urban routing rules
    urbanRules: {
      isSchoolZone: Boolean,
      schoolZoneHours: String, // "08:00-15:00"
      isCongestionChargingZone: Boolean,
      congestionChargingHours: String,
      isPedestrianZone: Boolean,
      pedestrianZoneHours: String,
      isEnvironmentalZone: Boolean,
      environmentalZoneRestrictions: String,
      airportRoutingRules: String, // Special routing for airports
      isTNPZone: Boolean, // Transportation Network Provider
      isPickupZone: Boolean,
      isDropoffZone: Boolean,
    },

    // Safety information
    safetyData: {
      accidentFrequency: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
      },
      accidentCount: {
        type: Number,
        default: 0,
      },
      injuryAccidents: Number,
      fatalAccidents: Number,
      speakingCountHistory: Number, // Speeding citations
      hasRiskZone: Boolean,
      riskLevel: {
        type: String,
        enum: ['safe', 'caution', 'high_risk', 'extreme_risk'],
        default: 'safe',
      },
      dangerousIntersections: [String], // Names of intersections
      poorLighting: Boolean,
      highPedestrianVolume: Boolean,
    },

    // Parking intelligence
    parkingData: {
      nearbyParkingZones: [
        {
          name: String,
          type: {
            type: String,
            enum: ['street', 'lot', 'garage', 'private'],
          },
          distanceMeters: Number,
          totalSpaces: Number,
          occupancyRate: Number, // 0-100%
          pricePerHour: Number,
          restrictions: String,
        },
      ],
      curbsideRules: [
        {
          side: {
            type: String,
            enum: ['north', 'south', 'east', 'west'],
          },
          allowedUsage: String, // 'pickup', 'dropoff', 'loading', 'taxi', 'rideshare'
          duration: Number, // minutes
          hours: String, // "08:00-18:00"
          restriction: String,
          penalty: String,
        },
      ],
    },

    // Weather context
    weatherContext: {
      hasSnowRemovalRoutes: Boolean,
      hasDrainageIssues: Boolean,
      floodProneIn: [String], // months
      windExposure: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
      stormDrainageCapacity: String,
    },

    // Building & landmark intelligence
    buildingData: {
      nearbyLandmarks: [
        {
          name: String,
          type: String,
          distanceMeters: Number,
          routingInstructions: String,
        },
      ],
      indoorMaps: {
        hasIndoorMapping: Boolean,
        indoorMapsProvider: String, // 'google', 'apple', 'custom'
        terminals: [String], // For airports
      },
      buildingFootprints: [
        {
          area: Number,
          address: String,
          amenities: [String],
        },
      ],
    },

    // Address intelligence
    addressData: {
      addressRanges: {
        evenSideStart: Number,
        evenSideEnd: Number,
        oddSideStart: Number,
        oddSideEnd: Number,
      },
      postalCode: String,
      cityDistrict: String,
      zone: String,
      timezones: [String],
      countryRegion: String,
      administrativeArea: String,
    },

    // Business intelligence
    businessContext: {
      nearbyBusinesses: [
        {
          name: String,
          category: String,
          hours: String,
          occupancyTrend: String, // 'busy', 'moderate', 'quiet'
        },
      ],
      eventZones: [
        {
          eventName: String,
          venue: String,
          dates: [Date],
          expectedImpact: String,
          routingRecommendation: String,
        },
      ],
    },

    // Real-time metrics
    metrics: {
      avgSpeed: Number,
      speedLimit: Number,
      congestionLevel: String,
      incidentCount: Number,
      lastUpdated: Date,
    },

    // Coordinates
    coordinates: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [lon, lat]
      },
    },

    // TTL
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      index: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial index
mapIntelligenceSchema.index({ 'coordinates': '2dsphere' });
mapIntelligenceSchema.index({ 'roadSegment.osmWayId': 1 });
mapIntelligenceSchema.index({ 'urbanRules.isPickupZone': 1 });
mapIntelligenceSchema.index({ 'urbanRules.isDropoffZone': 1 });
mapIntelligenceSchema.index({ 'safetyData.riskLevel': 1 });
mapIntelligenceSchema.index({ 'urbanRules.isAirportRoutingRules': 1 });

module.exports = mongoose.model('MapIntelligence', mapIntelligenceSchema);
