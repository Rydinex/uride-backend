const { queryNearbyDrivers } = require('../services/activeDriversStore');

async function getNearbyDrivers(req, res) {
  try {
    const { latitude, longitude, radiusKm = 5, limit = 20 } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'latitude and longitude query parameters are required.' });
    }

    const drivers = await queryNearbyDrivers({
      latitude,
      longitude,
      radiusKm,
      limit,
    });

    return res.status(200).json({
      count: drivers.length,
      drivers,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch nearby drivers.' });
  }
}

module.exports = {
  getNearbyDrivers,
};
