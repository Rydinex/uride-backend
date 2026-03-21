const MapIntelligence = require('../models/MapIntelligence');

class RydinexMapIntelligenceService {
  /**
   * Get all map intelligence for a route
   * @param {Array} routeCoordinates - [[lat, lon], [lat, lon], ...]
   * @returns {Object} Complete map intelligence for route
   */
  async getRouteIntelligence(routeCoordinates) {
    if (!routeCoordinates || routeCoordinates.length < 2) {
      throw new Error('At least 2 coordinates required');
    }

    try {
      const segments = [];

      for (let i = 0; i < routeCoordinates.length - 1; i++) {
        const [lat1, lon1] = routeCoordinates[i];
        const [lat2, lon2] = routeCoordinates[i + 1];

        const midLat = (lat1 + lat2) / 2;
        const midLon = (lon1 + lon2) / 2;

        const intel = await MapIntelligence.findOne({
          coordinates: {
            $near: {
              $geometry: { type: 'Point', coordinates: [midLon, midLat] },
              $maxDistance: 500,
            },
          },
        });

        if (intel) {
          segments.push(intel);
        }
      }

      return this._aggregateIntelligence(segments);
    } catch (error) {
      console.error('Error getting route intelligence:', error);
      throw error;
    }
  }

  /**
   * Get smart pickup points for a location
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Array} Smart pickup locations
   */
  async getSmartPickupPoints(latitude, longitude) {
    try {
      // Find pickup zones near location
      const zones = await MapIntelligence.find({
        'urbanRules.isPickupZone': true,
        'coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 1000,
          },
        },
      })
        .select('coordinates urbanRules roadSegment safetyData')
        .limit(10)
        .lean();

      return zones.map(zone => ({
        latitude: zone.coordinates.coordinates[1],
        longitude: zone.coordinates.coordinates[0],
        roadName: zone.roadSegment?.roadName,
        safetyRating: zone.safetyData?.riskLevel,
        curbsideRules: zone.parkingData?.curbsideRules,
        isLegal: zone.urbanRules?.isPickupZone,
        restriction: zone.urbanRules?.restrictions,
      }));
    } catch (error) {
      console.error('Error getting pickup points:', error);
      throw error;
    }
  }

  /**
   * Get urban zone warnings
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Array} Active warnings for location
   */
  async getUrbanZoneWarnings(latitude, longitude) {
    try {
      const intel = await MapIntelligence.findOne({
        coordinates: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 500,
          },
        },
      }).lean();

      if (!intel) return [];

      const warnings = [];

      // School zone
      if (intel.urbanRules?.isSchoolZone) {
        const schoolHours = intel.urbanRules?.schoolZoneHours;
        warnings.push({
          type: 'school_zone',
          message: `School zone active ${schoolHours}`,
          speedLimit: 20,
        });
      }

      // Congestion charging
      if (intel.urbanRules?.isCongestionChargingZone) {
        warnings.push({
          type: 'congestion_charge',
          message: 'Congestion charge area',
          hours: intel.urbanRules?.congestionChargingHours,
        });
      }

      // Environmental zone
      if (intel.urbanRules?.isEnvironmentalZone) {
        warnings.push({
          type: 'environmental_zone',
          message: 'Low emission zone',
          restrictions: intel.urbanRules?.environmentalZoneRestrictions,
        });
      }

      // High risk zone
      if (intel.safetyData?.riskLevel === 'high_risk' || intel.safetyData?.riskLevel === 'extreme_risk') {
        warnings.push({
          type: 'safety_warning',
          message: `High accident area: ${intel.safetyData?.accidentCount} incidents`,
          riskLevel: intel.safetyData?.riskLevel,
        });
      }

      return warnings;
    } catch (error) {
      console.error('Error getting warnings:', error);
      throw error;
    }
  }

  /**
   * Get parking information
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Object} Parking data
   */
  async getParkingInformation(latitude, longitude) {
    try {
      const intel = await MapIntelligence.findOne({
        coordinates: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 500,
          },
        },
      })
        .select('parkingData coordinates')
        .lean();

      if (!intel || !intel.parkingData) {
        return {
          nearbyParkingZones: [],
          curbsideRules: [],
        };
      }

      return {
        nearbyParkingZones: intel.parkingData.nearbyParkingZones || [],
        curbsideRules: intel.parkingData.curbsideRules || [],
      };
    } catch (error) {
      console.error('Error getting parking info:', error);
      throw error;
    }
  }

  /**
   * Get speed limit for location
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Number} Speed limit in km/h
   */
  async getSpeedLimit(latitude, longitude) {
    try {
      const intel = await MapIntelligence.findOne({
        coordinates: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 500,
          },
        },
      })
        .select('roadSegment.speedLimit urbanRules.isSchoolZone')
        .lean();

      if (!intel) return 50; // Default

      // School zone: reduce by 50%
      if (intel.urbanRules?.isSchoolZone) {
        return (intel.roadSegment?.speedLimit || 50) * 0.5;
      }

      return intel.roadSegment?.speedLimit || 50;
    } catch (error) {
      console.error('Error getting speed limit:', error);
      return 50;
    }
  }

  /**
   * Get risky intersections
   * @param {Number} latitude
   * @param {Number} longitude
   * @param {Number} radiusKm - Search radius
   * @returns {Array} Risky locations
   */
  async getRiskyLocations(latitude, longitude, radiusKm = 2) {
    try {
      const radiusMeters = radiusKm * 1000;

      const risky = await MapIntelligence.find({
        'safetyData.riskLevel': { $in: ['high_risk', 'extreme_risk'] },
        'coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: radiusMeters,
          },
        },
      })
        .select('coordinates roadSegment safetyData')
        .limit(20)
        .lean();

      return risky.map(r => ({
        latitude: r.coordinates.coordinates[1],
        longitude: r.coordinates.coordinates[0],
        roadName: r.roadSegment?.roadName,
        riskLevel: r.safetyData?.riskLevel,
        accidentCount: r.safetyData?.accidentCount,
        fatalAccidents: r.safetyData?.fatalAccidents,
      }));
    } catch (error) {
      console.error('Error getting risky locations:', error);
      throw error;
    }
  }

  /**
   * Get airport/special zone routing rules
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Object} Special routing rules
   */
  async getSpecialZoneRules(latitude, longitude) {
    try {
      const intel = await MapIntelligence.findOne({
        coordinates: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 2000,
          },
        },
      }).lean();

      if (!intel) return null;

      return {
        isAirport: !!intel.urbanRules?.airportRoutingRules,
        airportRules: intel.urbanRules?.airportRoutingRules,
        isTNPZone: intel.urbanRules?.isTNPZone,
        isPedestrianZone: intel.urbanRules?.isPedestrianZone,
        pedestrianZoneHours: intel.urbanRules?.pedestrianZoneHours,
        indoorMapping: intel.buildingData?.indoorMaps,
        terminals: intel.buildingData?.indoorMaps?.terminals,
      };
    } catch (error) {
      console.error('Error getting special zone rules:', error);
      return null;
    }
  }

  /**
   * Get nearby landmarks for navigation
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Array} Nearby landmarks
   */
  async getNearbyLandmarks(latitude, longitude) {
    try {
      const intel = await MapIntelligence.findOne({
        coordinates: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 1000,
          },
        },
      })
        .select('buildingData')
        .lean();

      return (intel?.buildingData?.nearbyLandmarks || []).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
    } catch (error) {
      console.error('Error getting landmarks:', error);
      return [];
    }
  }

  /**
   * Get elevation profile for route
   * @param {Array} routeCoordinates - [[lat, lon], ...]
   * @returns {Array} Elevation data
   */
  async getElevationProfile(routeCoordinates) {
    try {
      const segments = [];

      for (const [lat, lon] of routeCoordinates) {
        const intel = await MapIntelligence.findOne({
          coordinates: {
            $near: {
              $geometry: { type: 'Point', coordinates: [lon, lat] },
              $maxDistance: 200,
            },
          },
        })
          .select('elevation')
          .lean();

        if (intel?.elevation) {
          segments.push({
            latitude: lat,
            longitude: lon,
            elevation: intel.elevation.startElevation,
            terrain: intel.elevation.terrain,
            grade: intel.elevation.grade,
          });
        }
      }

      return segments;
    } catch (error) {
      console.error('Error getting elevation profile:', error);
      return [];
    }
  }

  /**
   * Get context intelligence (weather, events, patterns)
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Object} Context data
   */
  async getContextIntelligence(latitude, longitude) {
    try {
      const intel = await MapIntelligence.findOne({
        coordinates: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: 1000,
          },
        },
      }).lean();

      if (!intel) return {};

      return {
        weather: {
          floodProneMonths: intel.weatherContext?.floodProneIn,
          windExposure: intel.weatherContext?.windExposure,
          drainageIssues: intel.weatherContext?.hasDrainageIssues,
        },
        events: intel.businessContext?.eventZones || [],
        nearbyBusiness: intel.businessContext?.nearbyBusinesses || [],
      };
    } catch (error) {
      console.error('Error getting context intelligence:', error);
      return {};
    }
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Aggregate intelligence from multiple segments
   * @private
   */
  _aggregateIntelligence(segments) {
    if (segments.length === 0) {
      return { segments: [] };
    }

    const aggregated = {
      segments,
      totalWarnings: [],
      averageRiskLevel: 'safe',
      safetyRecommendations: [],
      routingConstraints: [],
      estimatedElevationGain: 0,
    };

    // Analyze each segment
    segments.forEach(seg => {
      // Safety
      if (seg.safetyData?.riskLevel === 'extreme_risk' || seg.safetyData?.riskLevel === 'high_risk') {
        aggregated.totalWarnings.push({
          type: 'safety',
          segment: seg.roadSegment?.roadName,
          message: `High accident zone (${seg.safetyData?.accidentCount} incidents)`,
        });
      }

      // Urban rules
      if (seg.urbanRules?.isSchoolZone) {
        aggregated.totalWarnings.push({
          type: 'school_zone',
          segment: seg.roadSegment?.roadName,
          message: `School zone ${seg.urbanRules?.schoolZoneHours}`,
        });
      }

      if (seg.urbanRules?.isCongestionChargingZone) {
        aggregated.totalWarnings.push({
          type: 'congestion_charge',
          segment: seg.roadSegment?.roadName,
          message: `Congestion charge area`,
        });
      }

      // Elevation
      if (seg.elevation?.startElevation && seg.elevation?.endElevation) {
        const elevGain = seg.elevation.endElevation - seg.elevation.startElevation;
        if (elevGain > 0) {
          aggregated.estimatedElevationGain += elevGain;
        }
      }

      // Constraints
      if (seg.roadSegment?.isTunnel) {
        aggregated.routingConstraints.push('Tunnel - possible signal loss');
      }
      if (seg.roadSegment?.isBridge) {
        aggregated.routingConstraints.push('Bridge - possible wind exposure');
      }
    });

    return aggregated;
  }
}

module.exports = new RydinexMapIntelligenceService();
