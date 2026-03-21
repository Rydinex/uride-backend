const LocationHistory = require('../models/LocationHistory');
const { getRedisClient } = require('./redisClient');

const LOCATION_CACHE_KEY = 'rydinex:trip:locations:';
const TRIP_POLYLINE_KEY = 'rydinex:trip:polyline:';

class RydinexMapsService {
  /**
   * Record a location point for a trip
   */
  async recordLocation(tripId, driverId, locationData) {
    try {
      const { latitude, longitude, accuracy, speed, heading, altitude } = locationData;

      if (!tripId || !driverId || latitude === undefined || longitude === undefined) {
        throw new Error('Missing required location fields');
      }

      // Save to MongoDB for history
      const locationRecord = await LocationHistory.create({
        tripId,
        driverId,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        altitude,
        timestamp: new Date(),
      });

      // Cache last location in Redis for real-time queries
      const redisClient = getRedisClient();
      const cacheKey = `${LOCATION_CACHE_KEY}${tripId}`;
      await redisClient.setex(
        cacheKey,
        3600, // 1 hour TTL
        JSON.stringify({
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          altitude,
          timestamp: Date.now(),
          driverId,
        })
      );

      // Update polyline (simplified for performance)
      await this.updateTripPolyline(tripId, latitude, longitude);

      return locationRecord;
    } catch (error) {
      console.error('Error recording location:', error);
      throw error;
    }
  }

  /**
   * Get trip polyline (all location points for a trip)
   */
  async getTripPolyline(tripId) {
    try {
      const locations = await LocationHistory.find({ tripId })
        .select('latitude longitude timestamp speed')
        .sort({ timestamp: 1 })
        .lean();

      return locations.map(loc => ({
        lat: loc.latitude,
        lng: loc.longitude,
        timestamp: loc.timestamp,
        speed: loc.speed,
      }));
    } catch (error) {
      console.error('Error fetching trip polyline:', error);
      throw error;
    }
  }

  /**
   * Update trip polyline in Redis for real-time display
   */
  async updateTripPolyline(tripId, latitude, longitude) {
    try {
      const redisClient = getRedisClient();
      const key = `${TRIP_POLYLINE_KEY}${tripId}`;

      // Store as GeoHash for spatial queries
      await redisClient.geoadd(
        key,
        longitude,
        latitude,
        `${latitude},${longitude},${Date.now()}`
      );

      // Set expiry (24 hours)
      await redisClient.expire(key, 86400);
    } catch (error) {
      console.error('Error updating polyline:', error);
    }
  }

  /**
   * Get last known location for a driver
   */
  async getLastLocation(driverId) {
    try {
      const location = await LocationHistory.findOne({ driverId })
        .sort({ timestamp: -1 })
        .select('latitude longitude timestamp speed heading')
        .lean();

      return location;
    } catch (error) {
      console.error('Error fetching last location:', error);
      throw error;
    }
  }

  /**
   * Get driver's location history for a date range
   */
  async getLocationHistory(driverId, startDate, endDate, limit = 1000) {
    try {
      const locations = await LocationHistory.find({
        driverId,
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      })
        .select('latitude longitude timestamp speed heading accuracy')
        .sort({ timestamp: 1 })
        .limit(limit)
        .lean();

      return locations;
    } catch (error) {
      console.error('Error fetching location history:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estimate ETA based on current speed and distance
   */
  estimateETA(distanceKm, speedKmh) {
    if (speedKmh <= 0) return null;
    const hours = distanceKm / speedKmh;
    return Math.round(hours * 60); // Return minutes
  }

  /**
   * Get trip statistics
   */
  async getTripStats(tripId) {
    try {
      const locations = await LocationHistory.find({ tripId })
        .select('latitude longitude speed timestamp')
        .sort({ timestamp: 1 })
        .lean();

      if (locations.length < 2) {
        return { distance: 0, duration: 0, avgSpeed: 0, maxSpeed: 0 };
      }

      let totalDistance = 0;
      let maxSpeed = 0;
      let speedSum = 0;
      let speedCount = 0;

      for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1];
        const curr = locations[i];

        totalDistance += this.calculateDistance(
          prev.latitude,
          prev.longitude,
          curr.latitude,
          curr.longitude
        );

        if (curr.speed > 0) {
          maxSpeed = Math.max(maxSpeed, curr.speed);
          speedSum += curr.speed;
          speedCount++;
        }
      }

      const duration = (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000 / 60; // minutes
      const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;

      return {
        distance: parseFloat(totalDistance.toFixed(2)),
        duration: Math.round(duration),
        avgSpeed: parseFloat(avgSpeed.toFixed(2)),
        maxSpeed: parseFloat(maxSpeed.toFixed(2)),
        pointCount: locations.length,
      };
    } catch (error) {
      console.error('Error calculating trip stats:', error);
      throw error;
    }
  }

  /**
   * Check if location is inside a geofence
   */
  isInsideGeofence(driverLat, driverLon, fenceLat, fenceLon, radiusKm) {
    const distance = this.calculateDistance(driverLat, driverLon, fenceLat, fenceLon);
    return distance <= radiusKm;
  }
}

module.exports = new RydinexMapsService();
