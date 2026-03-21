const Driver = require('../models/Driver');
const Rider = require('../models/Rider');
const Trip = require('../models/Trip');

const ACTIVE_TRIP_STATUSES = ['driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'];
const TERMINAL_TRIP_STATUSES = ['completed', 'cancelled', 'no_driver'];

const AIRPORT_PEAK_WINDOWS = [
  {
    airportCode: 'ORD',
    airportName: 'O Hare International',
    title: 'Morning Departures',
    localWindow: '05:00-09:00',
  },
  {
    airportCode: 'ORD',
    airportName: 'O Hare International',
    title: 'Evening Arrivals',
    localWindow: '16:00-21:00',
  },
  {
    airportCode: 'MDW',
    airportName: 'Midway International',
    title: 'Early Commuter Peak',
    localWindow: '04:30-07:30',
  },
  {
    airportCode: 'MDW',
    airportName: 'Midway International',
    title: 'After-Work Peak',
    localWindow: '15:30-19:30',
  },
];

function toPercent(value) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }

  return Number((Number(value) * 100).toFixed(2));
}

function resolveDemandBand(demandPressure) {
  if (demandPressure >= 0.5) {
    return 'high';
  }

  if (demandPressure >= 0.25) {
    return 'elevated';
  }

  return 'normal';
}

async function getNetworkOverview(req, res) {
  try {
    const now = Date.now();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last30m = new Date(now - 30 * 60 * 1000);

    const [activeRiders, approvedDrivers, pendingDrivers, activeTrips, completedTrips24h, terminalTrips24h, demandTrips30m] =
      await Promise.all([
        Rider.countDocuments({ status: 'active' }),
        Driver.countDocuments({ status: 'approved' }),
        Driver.countDocuments({ status: 'pending' }),
        Trip.countDocuments({ status: { $in: ACTIVE_TRIP_STATUSES } }),
        Trip.countDocuments({ status: 'completed', completedAt: { $gte: last24h } }),
        Trip.countDocuments({
          status: { $in: TERMINAL_TRIP_STATUSES },
          createdAt: { $gte: last24h },
        }),
        Trip.countDocuments({
          status: { $in: ['searching', 'driver_assigned'] },
          createdAt: { $gte: last30m },
        }),
      ]);

    const completionRate24h = terminalTrips24h > 0 ? completedTrips24h / terminalTrips24h : 1;
    const demandPressure = demandTrips30m / Math.max(approvedDrivers, 1);

    return res.status(200).json({
      generatedAt: new Date(now).toISOString(),
      network: {
        activeRiders,
        approvedDrivers,
        pendingDrivers,
        activeTrips,
      },
      reliability: {
        completedTrips24h,
        completionRate24h: toPercent(completionRate24h),
      },
      demand: {
        requestBurstsLast30m: demandTrips30m,
        demandPressure: Number(demandPressure.toFixed(4)),
        demandBand: resolveDemandBand(demandPressure),
      },
      airportPeakWindows: AIRPORT_PEAK_WINDOWS,
      appBridge: {
        rider: {
          deepLink: 'rydinex://open',
          fallbackPath: '/rider-app',
        },
        driver: {
          deepLink: 'rydinex-driver://open',
          fallbackPath: '/driver-app',
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load network overview.' });
  }
}

module.exports = {
  getNetworkOverview,
};
