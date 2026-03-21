const axios = require('axios');
const Geocode = require('../models/Geocode');

class RydinexGeocodingService {
  constructor() {
    // Nominatim (OpenStreetMap) - free geocoder
    this.nominatimUrl = 'https://nominatim.openstreetmap.org';
    // User-Agent required by Nominatim ToS
    this.userAgent = process.env.GEOCODING_USER_AGENT || 'URide-Geocoding/1.0';
    // Cache enabled by default
    this.useCache = process.env.GEOCODING_USE_CACHE !== 'false';
    // Rate limiting (Nominatim: 1 req/sec recommended)
    this.requestDelay = 200; // ms between requests
    this.lastRequestTime = 0;
  }

  /**
   * Geocode address to coordinates
   * @param {String} address - Address to geocode
   * @param {Object} options - Format, limit, zoom
   * @returns {Object} Geocoded result with coordinates and metadata
   */
  async geocodeAddress(address, options = {}) {
    const { format = 'json', limit = 5, zoom = 18, countryCode = null } = options;

    if (!address || address.trim().length === 0) {
      throw new Error('Address is required');
    }

    try {
      // Check cache first
      if (this.useCache) {
        const cached = await this._getFromCache('address', address);
        if (cached) {
          cached.source = 'cache';
          return cached;
        }
      }

      // Rate limiting
      await this._rateLimitCheck();

      // Call Nominatim API
      const params = {
        q: address,
        format: format,
        limit: limit,
        'accept-language': 'en',
      };

      if (countryCode) {
        params.countrycodes = countryCode;
      }

      const response = await axios.get(`${this.nominatimUrl}/search`, {
        params,
        headers: { 'User-Agent': this.userAgent },
        timeout: 5000,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error(`No results found for address: ${address}`);
      }

      // Parse results
      const results = response.data.map(item => this._parseNominatimResult(item));

      // Cache the top result
      if (this.useCache && results.length > 0) {
        await this._cacheResult('address', address, results[0]);
      }

      return {
        success: true,
        count: results.length,
        results,
        source: 'nominatim',
      };
    } catch (error) {
      console.error('Error geocoding address:', error.message);
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {Number} latitude - Latitude
   * @param {Number} longitude - Longitude
   * @param {Object} options - Zoom, format
   * @returns {Object} Address and metadata
   */
  async reverseGeocode(latitude, longitude, options = {}) {
    const { zoom = 18, format = 'json' } = options;

    if (latitude === null || longitude === null) {
      throw new Error('Latitude and longitude are required');
    }

    try {
      // Check cache first
      if (this.useCache) {
        const cached = await this._getFromCache('coordinates', `${latitude},${longitude}`);
        if (cached) {
          cached.source = 'cache';
          return cached;
        }
      }

      // Rate limiting
      await this._rateLimitCheck();

      // Call Nominatim API
      const params = {
        lat: latitude,
        lon: longitude,
        format: format,
        zoom: zoom,
        'accept-language': 'en',
      };

      const response = await axios.get(`${this.nominatimUrl}/reverse`, {
        params,
        headers: { 'User-Agent': this.userAgent },
        timeout: 5000,
      });

      const result = this._parseNominatimResult(response.data);

      // Cache result
      if (this.useCache) {
        await this._cacheResult('coordinates', `${latitude},${longitude}`, result);
      }

      return {
        success: true,
        result,
        source: 'nominatim',
      };
    } catch (error) {
      console.error('Error reverse geocoding:', error.message);
      throw error;
    }
  }

  /**
   * Batch geocode multiple addresses
   * @param {Array} addresses - Array of address strings
   * @param {Object} options - Formatting options
   * @returns {Array} Array of geocoded results
   */
  async batchGeocode(addresses, options = {}) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new Error('Addresses array is required');
    }

    if (addresses.length > 50) {
      throw new Error('Maximum 50 addresses per batch');
    }

    const results = [];

    for (const address of addresses) {
      try {
        const result = await this.geocodeAddress(address, options);
        results.push({
          address,
          success: true,
          result: result.results[0],
        });
      } catch (error) {
        results.push({
          address,
          success: false,
          error: error.message,
        });
      }

      // Add delay between requests to respect rate limits
      await this._delay(this.requestDelay);
    }

    return results;
  }

  /**
   * Batch reverse geocode multiple coordinates
   * @param {Array} coordinates - Array of {latitude, longitude} objects
   * @param {Object} options - Formatting options
   * @returns {Array} Array of addresses
   */
  async batchReverseGeocode(coordinates, options = {}) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      throw new Error('Coordinates array is required');
    }

    if (coordinates.length > 50) {
      throw new Error('Maximum 50 coordinates per batch');
    }

    const results = [];

    for (const coord of coordinates) {
      try {
        const result = await this.reverseGeocode(coord.latitude, coord.longitude, options);
        results.push({
          coordinate: coord,
          success: true,
          result: result.result,
        });
      } catch (error) {
        results.push({
          coordinate: coord,
          success: false,
          error: error.message,
        });
      }

      // Add delay between requests
      await this._delay(this.requestDelay);
    }

    return results;
  }

  /**
   * Autocomplete address (as user types)
   * @param {String} partial - Partial address
   * @param {Object} options - Limit, countryCode
   * @returns {Array} Suggestions
   */
  async autocomplete(partial, options = {}) {
    const { limit = 5, countryCode = null } = options;

    if (!partial || partial.trim().length < 3) {
      return [];
    }

    try {
      // Use search endpoint with fewer results for autocomplete
      const params = {
        q: partial,
        format: 'json',
        limit: limit,
        dedupe: 1,
        'accept-language': 'en',
      };

      if (countryCode) {
        params.countrycodes = countryCode;
      }

      const response = await axios.get(`${this.nominatimUrl}/search`, {
        params,
        headers: { 'User-Agent': this.userAgent },
        timeout: 3000,
      });

      return response.data.map(item => ({
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        placeId: item.place_id,
      }));
    } catch (error) {
      console.error('Error autocompleting address:', error.message);
      return [];
    }
  }

  /**
   * Get details about a place
   * @param {Number} placeId - Nominatim place ID
   * @returns {Object} Place details
   */
  async getPlaceDetails(placeId, options = {}) {
    const { format = 'json', zoom = 18 } = options;

    if (!placeId) {
      throw new Error('Place ID is required');
    }

    try {
      await this._rateLimitCheck();

      const params = {
        osm_id: placeId,
        format: format,
        zoom: zoom,
        'accept-language': 'en',
      };

      const response = await axios.get(`${this.nominatimUrl}/details`, {
        params,
        headers: { 'User-Agent': this.userAgent },
        timeout: 5000,
      });

      return this._parseNominatimResult(response.data);
    } catch (error) {
      console.error('Error getting place details:', error.message);
      throw error;
    }
  }

  /**
   * Find nearest address to coordinates (reverse + radius)
   * Useful for finding nearest landmarks, streets, etc.
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Object} Nearest address
   */
  async findNearestAddress(latitude, longitude) {
    try {
      const result = await this.reverseGeocode(latitude, longitude, { zoom: 18 });
      return result.result;
    } catch (error) {
      console.error('Error finding nearest address:', error.message);
      throw error;
    }
  }

  /**
   * Track geocode usage for analytics
   * @param {String} userId - User ID
   * @param {String} query - Original query
   * @param {Object} result - Geocoded result
   */
  async trackUsage(userId, query, result) {
    try {
      const existing = await Geocode.findOne({
        placeId: result.placeId,
      });

      if (existing) {
        existing.usageCount += 1;
        existing.lastUsed = new Date();
        await existing.save();
      } else {
        await Geocode.create({
          query,
          queryType: result.queryType || 'address',
          address: result.address,
          latitude: result.latitude,
          longitude: result.longitude,
          displayName: result.displayName,
          placeId: result.placeId,
          osmType: result.osmType,
          osmId: result.osmId,
          userId,
          provider: 'nominatim',
        });
      }
    } catch (error) {
      console.error('Error tracking usage:', error.message);
    }
  }

  /**
   * Get popular locations (most searched)
   * @param {Number} limit - How many to return
   * @returns {Array} Popular geocodes
   */
  async getPopularLocations(limit = 10) {
    try {
      return await Geocode.find()
        .sort({ usageCount: -1 })
        .limit(limit)
        .select('displayName latitude longitude usageCount');
    } catch (error) {
      console.error('Error getting popular locations:', error.message);
      throw error;
    }
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Parse Nominatim API result
   * @private
   */
  _parseNominatimResult(data) {
    const address = data.address || {};

    return {
      displayName: data.display_name,
      latitude: parseFloat(data.lat),
      longitude: parseFloat(data.lon),
      placeId: data.place_id,
      osmType: data.osm_type,
      osmId: data.osm_id,
      addressType: data.addresstype || data.type,
      category: data.class,
      type: data.type,
      importance: parseFloat(data.importance) || 0,
      address: {
        housenumber: address.house_number,
        street: address.road || address.street,
        city: address.city || address.town || address.village,
        state: address.state,
        postcode: address.postcode,
        country: address.country,
        fullAddress: data.display_name,
      },
      boundingBox: data.boundingbox
        ? {
            north: parseFloat(data.boundingbox[1]),
            south: parseFloat(data.boundingbox[0]),
            east: parseFloat(data.boundingbox[3]),
            west: parseFloat(data.boundingbox[2]),
          }
        : null,
    };
  }

  /**
   * Get from cache
   * @private
   */
  async _getFromCache(type, query) {
    try {
      const key = type === 'address' ? { 'address.fullAddress': query } : { latitude: query.split(',')[0], longitude: query.split(',')[1] };

      return await Geocode.findOne(key, null, { sort: { usageCount: -1 } });
    } catch (error) {
      return null;
    }
  }

  /**
   * Save to cache
   * @private
   */
  async _cacheResult(type, query, result) {
    try {
      const cacheData = {
        query,
        queryType: type,
        address: result.address,
        latitude: result.latitude,
        longitude: result.longitude,
        displayName: result.displayName,
        placeId: result.placeId,
        osmType: result.osmType,
        osmId: result.osmId,
        addressType: result.addressType,
        category: result.category,
        type: result.type,
        importance: result.importance,
        provider: 'nominatim',
      };

      // Check if already cached
      const existing = await Geocode.findOne({ placeId: result.placeId });
      if (existing) {
        existing.usageCount += 1;
        existing.lastUsed = new Date();
        await existing.save();
      } else {
        await Geocode.create(cacheData);
      }
    } catch (error) {
      console.error('Error caching result:', error.message);
    }
  }

  /**
   * Rate limiting
   * @private
   */
  async _rateLimitCheck() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestDelay) {
      await this._delay(this.requestDelay - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Delay helper
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new RydinexGeocodingService();
