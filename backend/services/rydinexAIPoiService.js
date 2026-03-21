const POI = require('../models/POI');

class RydinexAIPoiService {
  /**
   * Find nearby POI by coordinates and radius
   * @param {Number} latitude - Current latitude
   * @param {Number} longitude - Current longitude
   * @param {Number} radiusKm - Search radius in kilometers
   * @param {Object} options - Filter options (category, minRating, limit)
   * @returns {Array} Array of nearby POI sorted by distance
   */
  async findNearbyPOI(latitude, longitude, radiusKm = 2, options = {}) {
    const { category = null, minRating = 0, limit = 10, aiSmart = true } = options;

    try {
      const radiusMeters = radiusKm * 1000;

      const query = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusMeters,
          },
        },
        isOpen: true,
        rating: { $gte: minRating },
      };

      if (category) {
        query.category = category;
      }

      let poiList = await POI.find(query).limit(limit).lean();

      // Calculate relevance score for AI recommendations
      if (aiSmart) {
        poiList = poiList.map(poi => ({
          ...poi,
          distance: this._calculateDistance(latitude, longitude, poi.latitude, poi.longitude),
          relevanceScore: this._calculateRelevanceScore(poi),
        }));

        // Sort by relevance (AI-powered)
        poiList.sort((a, b) => b.relevanceScore - a.relevanceScore);
      }

      return poiList;
    } catch (error) {
      console.error('Error finding nearby POI:', error);
      throw error;
    }
  }

  /**
   * Get POI recommendations based on current route
   * @param {Array} routePoints - Array of [lat, lon] points along the route
   * @param {Object} preferences - User preferences (categories, budget, etc.)
   * @returns {Array} Recommended POI along the route
   */
  async getRouteRecommendations(routePoints, preferences = {}) {
    const {
      categories = null,
      maxDistance = 0.5, // 500m from route
      minRating = 3.5,
      limit = 5,
    } = preferences;

    try {
      const recommendations = [];
      const processedNames = new Set();

      // Check POI near each point in the route
      for (const [lat, lon] of routePoints) {
        const nearbyPOI = await this.findNearbyPOI(lat, lon, maxDistance, {
          category: categories?.[0] || null,
          minRating,
          limit: 3,
          aiSmart: true,
        });

        for (const poi of nearbyPOI) {
          // Avoid duplicates
          if (!processedNames.has(poi.name)) {
            processedNames.add(poi.name);
            recommendations.push({
              ...poi,
              routeDistance: this._calculateDistance(lat, lon, poi.latitude, poi.longitude),
              reason: this._generateRecommendationReason(poi),
            });
          }
        }
      }

      // Sort by relevance and remove duplicates
      return recommendations
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting route recommendations:', error);
      throw error;
    }
  }

  /**
   * Search POI by name or address
   * @param {String} searchTerm - Search text
   * @param {Object} options - Filter options
   * @returns {Array} Matching POI
   */
  async searchPOI(searchTerm, options = {}) {
    const { latitude = null, longitude = null, radiusKm = 5, limit = 10 } = options;

    try {
      const query = { isOpen: true };

      // Text search
      if (searchTerm) {
        query.$text = { $search: searchTerm };
      }

      let results = await POI.find(query).limit(limit * 2).lean();

      // Filter by location if provided
      if (latitude && longitude) {
        const radiusMeters = radiusKm * 1000;
        results = results.filter(poi => {
          const distance = this._calculateDistance(latitude, longitude, poi.latitude, poi.longitude);
          return distance <= radiusKm;
        });

        results = results.map(poi => ({
          ...poi,
          distance: this._calculateDistance(latitude, longitude, poi.latitude, poi.longitude),
        }));

        results.sort((a, b) => a.distance - b.distance);
      }

      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching POI:', error);
      throw error;
    }
  }

  /**
   * Get emergency services near location
   * @param {Number} latitude
   * @param {Number} longitude
   * @param {Number} radiusKm
   * @returns {Array} Emergency POI (hospitals, police, etc.)
   */
  async getEmergencyServices(latitude, longitude, radiusKm = 5) {
    try {
      return await this.findNearbyPOI(latitude, longitude, radiusKm, {
        minRating: 0,
        limit: 5,
        aiSmart: false,
      });
    } catch (error) {
      console.error('Error getting emergency services:', error);
      throw error;
    }
  }

  /**
   * Get POI by category with AI sorting
   * @param {String} category - POI category
   * @param {Object} options - Filter and location options
   * @returns {Array} Sorted POI
   */
  async getPOIByCategory(category, options = {}) {
    const { latitude = null, longitude = null, radiusKm = 5, limit = 20 } = options;

    try {
      if (latitude && longitude) {
        return await this.findNearbyPOI(latitude, longitude, radiusKm, {
          category,
          limit,
          aiSmart: true,
        });
      }

      const query = { category, isOpen: true };
      return await POI.find(query)
        .sort({ aiRelevanceScore: -1, rating: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting POI by category:', error);
      throw error;
    }
  }

  /**
   * Log POI visit for analytics
   * @param {String} poiId - POI ID
   * @param {String} userId - User ID
   */
  async logPOIVisit(poiId, userId) {
    try {
      await POI.findByIdAndUpdate(poiId, { $inc: { visits: 1 } });
      // Could log to analytics service here
    } catch (error) {
      console.error('Error logging POI visit:', error);
    }
  }

  /**
   * AI Recommendation Engine - Calculate relevance score
   * @private
   */
  _calculateRelevanceScore(poi) {
    let score = 0;

    // Rating weight (0-40 points)
    score += (poi.rating / 5) * 40;

    // Popularity weight (0-30 points)
    score += Math.min((poi.visits / 1000) * 30, 30);

    // Review count weight (0-20 points)
    score += Math.min((poi.reviewCount / 100) * 20, 20);

    // AI tags bonus (0-10 points)
    if (poi.aiTags) {
      if (poi.aiTags.includes('recommended')) score += 8;
      if (poi.aiTags.includes('popular')) score += 5;
      if (poi.aiTags.includes('emergency')) score += 10;
    }

    // Price level modifier
    // Budget-friendly gets slight boost
    if (poi.priceLevel === 1) score += 2;

    return Math.min(score, 100);
  }

  /**
   * Haversine distance calculation
   * @private
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
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
   * Generate human-readable recommendation reason
   * @private
   */
  _generateRecommendationReason(poi) {
    const reasons = [];

    if (poi.rating >= 4.5) reasons.push('Highly rated');
    if (poi.aiTags?.includes('popular')) reasons.push('Popular');
    if (poi.aiTags?.includes('recommended')) reasons.push('Recommended');
    if (poi.priceLevel === 1) reasons.push('Budget-friendly');
    if (poi.aiTags?.includes('new')) reasons.push('New');

    return reasons.length > 0 ? reasons.join(' • ') : 'Nearby option';
  }

  /**
   * Batch create POI for seeding database
   * @param {Array} poiData - Array of POI data
   */
  async seedPOI(poiData) {
    try {
      const formattedData = poiData.map(poi => ({
        ...poi,
        location: {
          type: 'Point',
          coordinates: [poi.longitude, poi.latitude],
        },
      }));

      return await POI.insertMany(formattedData);
    } catch (error) {
      console.error('Error seeding POI:', error);
      throw error;
    }
  }
}

module.exports = new RydinexAIPoiService();
