const Traffic = require('../models/Traffic');
const LocationHistory = require('../models/LocationHistory');

class RydinexTrafficService {
  /**
   * Report speed/location data from a driver
   * Used to build real-time traffic picture
   * @param {Object} data - {latitude, longitude, speed, driverId, accuracy}
   */
  async reportTrafficData(data) {
    const { latitude, longitude, speed, driverId, accuracy = 100 } = data;

    if (!latitude || !longitude || speed === undefined || !driverId) {
      throw new Error('Missing required fields: latitude, longitude, speed, driverId');
    }

    try {
      // Round coordinates to a grid (e.g., 100m precision) to group nearby reports
      const gridSize = 0.001; // ~100 meters
      const gridLat = Math.round(latitude / gridSize) * gridSize;
      const gridLon = Math.round(longitude / gridSize) * gridSize;

      // Find or create traffic record for this segment
      let traffic = await Traffic.findOne({
        'roadSegment.startLatitude': { $near: gridLat, $maxDistance: 0.0005 },
        'roadSegment.startLongitude': { $near: gridLon, $maxDistance: 0.0005 },
      });

      if (!traffic) {
        traffic = new Traffic({
          roadSegment: {
            startLatitude: gridLat,
            startLongitude: gridLon,
            endLatitude: gridLat + gridSize,
            endLongitude: gridLon + gridSize,
          },
          coordinates: {
            type: 'Point',
            coordinates: [gridLon, gridLat],
          },
        });
      }

      // Add data point
      traffic.dataPoints.push({
        speed,
        timestamp: new Date(),
        driverId,
        accuracy,
      });

      // Keep only last 100 data points
      if (traffic.dataPoints.length > 100) {
        traffic.dataPoints = traffic.dataPoints.slice(-100);
      }

      // Recalculate metrics
      await this._updateTrafficMetrics(traffic);

      traffic.lastUpdate = new Date();
      await traffic.save();

      return traffic;
    } catch (error) {
      console.error('Error reporting traffic data:', error);
      throw error;
    }
  }

  /**
   * Get current traffic for a route
   * @param {Array} routeCoordinates - Array of [lat, lon] points along route
   * @returns {Object} Traffic data for the route
   */
  async getTrafficForRoute(routeCoordinates) {
    if (!routeCoordinates || routeCoordinates.length < 2) {
      throw new Error('At least 2 coordinates required');
    }

    try {
      const trafficSegments = [];

      // Get traffic for each segment
      for (let i = 0; i < routeCoordinates.length - 1; i++) {
        const [lat1, lon1] = routeCoordinates[i];
        const [lat2, lon2] = routeCoordinates[i + 1];

        const traffic = await this._getTrafficBetween(lat1, lon1, lat2, lon2);
        if (traffic) {
          trafficSegments.push(traffic);
        }
      }

      // Calculate aggregate metrics
      const totalDelay = trafficSegments.reduce((sum, t) => sum + (t.etaImpact?.delaySeconds || 0), 0);
      const averageCongestion = trafficSegments.reduce((sum, t) => sum + (t.congestionScore || 0), 0) / trafficSegments.length;
      const worstCongestion = Math.max(...trafficSegments.map(t => t.congestionScore || 0));

      return {
        segments: trafficSegments,
        totalDelay: Math.round(totalDelay),
        totalDelayMinutes: Math.round(totalDelay / 60),
        averageCongestion: Math.round(averageCongestion),
        worstCongestion,
        hasMajorIncidents: trafficSegments.some(t => t.incidents?.length > 0),
      };
    } catch (error) {
      console.error('Error getting traffic for route:', error);
      throw error;
    }
  }

  /**
   * Get traffic heatmap for an area
   * @param {Number} latitude - Center latitude
   * @param {Number} longitude - Center longitude
   * @param {Number} radiusKm - Search radius
   * @returns {Array} Traffic points with congestion levels
   */
  async getTrafficHeatmap(latitude, longitude, radiusKm = 2) {
    try {
      const radiusMeters = radiusKm * 1000;

      const heatmap = await Traffic.find({
        'coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusMeters,
          },
        },
      })
        .select('coordinates congestionScore congestionLevel currentSpeed')
        .limit(500)
        .lean();

      return heatmap.map(t => ({
        latitude: t.coordinates.coordinates[1],
        longitude: t.coordinates.coordinates[0],
        congestionScore: t.congestionScore,
        congestionLevel: t.congestionLevel,
        speed: t.currentSpeed,
      }));
    } catch (error) {
      console.error('Error getting traffic heatmap:', error);
      throw error;
    }
  }

  /**
   * Report an incident (accident, construction, etc.)
   * @param {Object} incident - Incident details
   */
  async reportIncident(incident) {
    const { latitude, longitude, type, description, severity, reportedBy, radius = 100 } = incident;

    if (!latitude || !longitude || !type) {
      throw new Error('Missing required fields');
    }

    try {
      // Find traffic segments affected
      const affectedTraffic = await Traffic.find({
        'coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radius,
          },
        },
      });

      // Add incident to all affected segments
      const incidentData = {
        type,
        description,
        severity,
        reportedBy,
        timestamp: new Date(),
        affectedArea: {
          latitude,
          longitude,
          radius,
        },
      };

      for (const traffic of affectedTraffic) {
        traffic.incidents = traffic.incidents || [];
        traffic.incidents.push(incidentData);
        traffic.congestionLevel = 'severe'; // Incidents cause severe congestion
        traffic.congestionScore = 85;
        await traffic.save();
      }

      return {
        success: true,
        affectedSegments: affectedTraffic.length,
        incident: incidentData,
      };
    } catch (error) {
      console.error('Error reporting incident:', error);
      throw error;
    }
  }

  /**
   * Get predicted speed for a time/day
   * @param {Number} latitude
   * @param {Number} longitude
   * @param {Date} predictFor - Date/time to predict for
   * @returns {Object} Predicted speed and congestion
   */
  async getPredictedTraffic(latitude, longitude, predictFor = new Date()) {
    try {
      const hour = predictFor.getHours();
      const dayOfWeek = predictFor.getDay();

      const traffic = await Traffic.findOne({
        'coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: 500,
          },
        },
      });

      if (!traffic) {
        return null;
      }

      // Look for historical pattern for this hour
      const historicalPattern = traffic.peakHours?.find(p => p.hour === hour);

      if (historicalPattern) {
        return {
          predictedSpeed: historicalPattern.averageSpeed,
          congestionLevel: historicalPattern.congestionLevel,
          confidence: 'high',
          basedOn: `${historicalPattern.frequency} occurrences`,
        };
      }

      // Fall back to current speed
      return {
        predictedSpeed: traffic.currentSpeed || traffic.averageSpeed,
        congestionLevel: traffic.congestionLevel,
        confidence: 'medium',
        basedOn: 'current conditions',
      };
    } catch (error) {
      console.error('Error predicting traffic:', error);
      throw error;
    }
  }

  /**
   * Get top congested roads
   * @param {Number} limit - How many to return
   * @returns {Array} Most congested roads
   */
  async getTopCongestedRoads(limit = 10) {
    try {
      return await Traffic.find({
        congestionScore: { $gt: 30 },
      })
        .sort({ congestionScore: -1 })
        .limit(limit)
        .select('roadSegment congestionScore congestionLevel currentSpeed')
        .lean();
    } catch (error) {
      console.error('Error getting congested roads:', error);
      throw error;
    }
  }

  /**
   * Update traffic metrics (called after each speed report)
   * @private
   */
  async _updateTrafficMetrics(traffic) {
    if (!traffic.dataPoints || traffic.dataPoints.length === 0) {
      return;
    }

    // Calculate speeds
    const speeds = traffic.dataPoints.map(dp => dp.speed);
    const currentSpeed = speeds[speeds.length - 1]; // Latest speed
    const averageSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds);

    traffic.currentSpeed = currentSpeed;
    traffic.averageSpeed = averageSpeed;
    traffic.maxSpeed = maxSpeed;
    traffic.minSpeed = minSpeed;
    traffic.sampleCount = traffic.dataPoints.length;

    // Calculate congestion level
    const speedLimit = traffic.roadSegment.speedLimit || 50; // Default 50 km/h
    const speedPercentage = (currentSpeed / speedLimit) * 100;

    traffic.speedPercentage = speedPercentage;

    let congestionScore, congestionLevel;

    if (speedPercentage >= 80) {
      congestionScore = 10;
      congestionLevel = 'free_flow';
    } else if (speedPercentage >= 60) {
      congestionScore = 30;
      congestionLevel = 'light';
    } else if (speedPercentage >= 40) {
      congestionScore = 50;
      congestionLevel = 'moderate';
    } else if (speedPercentage >= 20) {
      congestionScore = 75;
      congestionLevel = 'heavy';
    } else {
      congestionScore = 95;
      congestionLevel = 'severe';
    }

    traffic.congestionScore = congestionScore;
    traffic.congestionLevel = congestionLevel;

    // Calculate ETA impact
    const segmentDistance = 0.1; // ~100m for grid cell
    const normalDuration = (segmentDistance / speedLimit) * 3600; // seconds
    const estimatedDuration = (segmentDistance / currentSpeed) * 3600;
    const delaySeconds = estimatedDuration - normalDuration;

    traffic.etaImpact = {
      normalDuration: Math.round(normalDuration),
      estimatedDuration: Math.round(estimatedDuration),
      delaySeconds: Math.round(delaySeconds),
      delayPercentage: Math.round((delaySeconds / normalDuration) * 100),
    };

    // Update hourly pattern
    const hour = new Date().getHours();
    const existingHour = traffic.peakHours?.find(p => p.hour === hour);

    if (existingHour) {
      existingHour.averageSpeed = (existingHour.averageSpeed + averageSpeed) / 2;
      existingHour.congestionLevel = congestionLevel;
      existingHour.frequency += 1;
    } else {
      traffic.peakHours = traffic.peakHours || [];
      traffic.peakHours.push({
        hour,
        averageSpeed,
        congestionLevel,
        frequency: 1,
      });
    }

    // Calculate trends
    if (traffic.dataPoints.length > 5) {
      const recentSpeeds = speeds.slice(-5);
      const recentAvg = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;
      const olderSpeeds = speeds.slice(-10, -5);
      const olderAvg = olderSpeeds.reduce((a, b) => a + b, 0) / olderSpeeds.length;

      if (recentAvg > olderAvg * 1.1) {
        traffic.trend = 'improving';
      } else if (recentAvg < olderAvg * 0.9) {
        traffic.trend = 'degrading';
      } else {
        traffic.trend = 'stable';
      }
    }

    // Update 1-hour average
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const lastHourSpeeds = traffic.dataPoints
      .filter(dp => new Date(dp.timestamp) > oneHourAgo)
      .map(dp => dp.speed);

    if (lastHourSpeeds.length > 0) {
      traffic.lastHourAverageSpeed = lastHourSpeeds.reduce((a, b) => a + b, 0) / lastHourSpeeds.length;
    }
  }

  /**
   * Get traffic between two points
   * @private
   */
  async _getTrafficBetween(lat1, lon1, lat2, lon2) {
    try {
      // Find traffic data for this segment
      const midLat = (lat1 + lat2) / 2;
      const midLon = (lon1 + lon2) / 2;

      const traffic = await Traffic.findOne({
        'coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [midLon, midLat],
            },
            $maxDistance: 200,
          },
        },
      });

      return traffic;
    } catch (error) {
      console.error('Error getting traffic between points:', error);
      return null;
    }
  }
}

module.exports = new RydinexTrafficService();
