const AirportQueue = require('../models/AirportQueueEntry');
const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const SafetyLog = require('../models/SafetyLog');

const AIRPORT_CODES = ['ORD', 'MDW'];
const ONGOING_TRIP_STATUSES = ['driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'];

function normalizeAirportCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return AIRPORT_CODES.includes(code) ? code : null;
}

function normalizeQueueGroup(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'standard') {
    return { queryValue: 'regular', responseValue: 'standard' };
  }

  if (normalized === 'black') {
    return { queryValue: 'black_car', responseValue: 'black' };
  }

  if (normalized === 'regular') {
    return { queryValue: 'regular', responseValue: 'standard' };
  }

  if (normalized === 'black_car') {
    return { queryValue: 'black_car', responseValue: 'black' };
  }

  return null;
}

async function getAirportSummary(req, res) {
  try {
    const summary = {};

    for (const code of AIRPORT_CODES) {
      const standardQueueCount = await AirportQueue.countDocuments({
        queueType: 'airport',
        airportCode: code,
        queueGroup: 'regular',
        status: 'waiting',
      });

      const blackQueueCount = await AirportQueue.countDocuments({
        queueType: 'airport',
        airportCode: code,
        queueGroup: 'black_car',
        status: 'waiting',
      });

      const stagingDriverIds = await AirportQueue.distinct('driver', {
        queueType: 'airport',
        airportCode: code,
        status: 'waiting',
      });

      const activeTrips = await Trip.countDocuments({
        queueAirportCode: code,
        status: { $in: ONGOING_TRIP_STATUSES },
      });

      summary[code] = {
        standardQueue: standardQueueCount,
        blackQueue: blackQueueCount,
        driversInStaging: stagingDriverIds.length,
        activeTrips,
      };
    }

    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch airport summary.' });
  }
}

async function getQueue(req, res) {
  try {
    const airportCode = normalizeAirportCode(req.params.airportCode);
    const queueGroup = normalizeQueueGroup(req.params.queueGroup);

    if (!airportCode) {
      return res.status(400).json({ message: 'airportCode must be ORD or MDW.' });
    }

    if (!queueGroup) {
      return res.status(400).json({ message: 'queueGroup must be standard or black.' });
    }

    const entries = await AirportQueue.find({
      queueType: 'airport',
      airportCode,
      queueGroup: queueGroup.queryValue,
      status: 'waiting',
    })
      .sort({ joinedAt: 1 })
      .populate({
        path: 'driver',
        select: '_id name vehicle',
        populate: {
          path: 'vehicle',
          select: 'make model',
        },
      });

    const payload = entries.map((entry, idx) => {
      const driver = entry.driver || {};
      const vehicle = driver.vehicle || {};
      const car = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim() || 'Unknown vehicle';

      return {
        driverId: driver._id || null,
        name: driver.name || 'Unknown driver',
        car,
        position: idx + 1,
        joinedAt: entry.joinedAt,
      };
    });

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch airport queue.' });
  }
}

async function getStagingDrivers(req, res) {
  try {
    const airportCode = normalizeAirportCode(req.params.airportCode);
    const queueGroup = normalizeQueueGroup(req.params.queueGroup);

    if (!airportCode) {
      return res.status(400).json({ message: 'airportCode must be ORD or MDW.' });
    }

    if (!queueGroup) {
      return res.status(400).json({ message: 'queueGroup must be standard or black.' });
    }

    const entries = await AirportQueue.find({
      queueType: 'airport',
      airportCode,
      queueGroup: queueGroup.queryValue,
      status: 'waiting',
    })
      .sort({ joinedAt: 1 })
      .populate({
        path: 'driver',
        select: '_id name phone email vehicle',
        populate: {
          path: 'vehicle',
          select: 'make model plateNumber color',
        },
      });

    const drivers = entries
      .map(entry => {
        const driver = entry.driver;
        if (!driver) {
          return null;
        }

        return {
          driverId: driver._id,
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          queueGroup: queueGroup.responseValue,
          joinedAt: entry.joinedAt,
          lotCode: entry.lotCode || null,
          pickupZoneCode: entry.pickupZoneCode || null,
          vehicle: driver.vehicle
            ? {
                make: driver.vehicle.make || null,
                model: driver.vehicle.model || null,
                plateNumber: driver.vehicle.plateNumber || null,
                color: driver.vehicle.color || null,
              }
            : null,
        };
      })
      .filter(Boolean);

    return res.status(200).json(drivers);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch staging drivers.' });
  }
}

async function getViolations(req, res) {
  try {
    const logs = await SafetyLog.find({
      incidentType: /queue|airport|lane|terminal/i,
      status: 'open',
    })
      .populate('driver', '_id name')
      .sort({ createdAt: -1 })
      .limit(500);

    const payload = logs.map(log => ({
      id: log._id,
      driverId: log.driver?._id || null,
      driverName: log.driver?.name || null,
      incidentType: log.incidentType,
      severity: log.severity,
      createdAt: log.createdAt,
      description: log.description,
    }));

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch airport violations.' });
  }
}

module.exports = {
  getAirportSummary,
  getQueue,
  getStagingDrivers,
  getViolations,
};
