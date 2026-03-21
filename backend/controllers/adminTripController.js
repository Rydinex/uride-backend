const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const Complaint = require('../models/Complaint');
const SafetyLog = require('../models/SafetyLog');

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

async function listTrips(req, res) {
  try {
    const { status, limit = 100, from, to } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = fromDate;
      }
      if (toDate) {
        query.createdAt.$lte = toDate;
      }
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const trips = await Trip.find(query)
      .populate('rider', 'name phone email')
      .populate('driver', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(parsedLimit);

    return res.status(200).json(trips);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch trips.' });
  }
}

async function getTripMonitoringMap(req, res) {
  try {
    const activeStatuses = ['driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'];

    const trips = await Trip.find({ status: { $in: activeStatuses } })
      .populate('rider', 'name phone')
      .populate('driver', 'name phone')
      .sort({ updatedAt: -1 })
      .limit(300)
      .select('pickup dropoff status currentDriverLocation routePoints rider driver updatedAt surgeMultiplier upfrontFare fareEstimate');

    const mapTrips = trips.map(trip => ({
      tripId: String(trip._id),
      status: trip.status,
      pickup: trip.pickup,
      dropoff: trip.dropoff,
      currentDriverLocation: trip.currentDriverLocation || null,
      routePointCount: Array.isArray(trip.routePoints) ? trip.routePoints.length : 0,
      rider: trip.rider,
      driver: trip.driver,
      surgeMultiplier: trip.surgeMultiplier || 1,
      fare: trip.fareEstimate || trip.upfrontFare || 0,
      updatedAt: trip.updatedAt,
    }));

    return res.status(200).json({
      count: mapTrips.length,
      trips: mapTrips,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch trip monitoring data.' });
  }
}

async function getComplianceReport(req, res) {
  try {
    const { from, to } = req.query;

    const defaultFromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fromDate = parseDate(from) || defaultFromDate;
    const toDate = parseDate(to) || new Date();

    const dateFilter = {
      createdAt: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    const [
      totalTrips,
      completedTrips,
      cancelledTrips,
      activeTrips,
      completedWithoutReceipt,
      pendingDriverApprovals,
      rejectedDrivers,
      activeDrivers,
      openComplaints,
      resolvedComplaints,
      openSafetyIncidents,
      criticalSafetyIncidents,
      expiringOrExpiredDriverDocuments,
      durationAggregation,
    ] = await Promise.all([
      Trip.countDocuments(dateFilter),
      Trip.countDocuments({ ...dateFilter, status: 'completed' }),
      Trip.countDocuments({ ...dateFilter, status: 'cancelled' }),
      Trip.countDocuments({ ...dateFilter, status: { $in: ['driver_assigned', 'driver_accepted', 'driver_arrived_pickup', 'in_progress'] } }),
      Trip.countDocuments({ ...dateFilter, status: 'completed', receipt: null }),
      Driver.countDocuments({ status: 'pending' }),
      Driver.countDocuments({ status: 'rejected' }),
      Driver.countDocuments({ status: 'approved' }),
      Complaint.countDocuments({ ...dateFilter, status: { $in: ['open', 'in_review'] } }),
      Complaint.countDocuments({ ...dateFilter, status: 'resolved' }),
      SafetyLog.countDocuments({ ...dateFilter, status: { $in: ['open', 'investigating'] } }),
      SafetyLog.countDocuments({ ...dateFilter, severity: { $in: ['high', 'critical'] } }),
      Driver.countDocuments({
        docs: {
          $elemMatch: {
            expiresAt: { $ne: null, $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          },
        },
      }),
      Trip.aggregate([
        {
          $match: {
            ...dateFilter,
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            averageDurationMinutes: { $avg: '$actualDurationMinutes' },
            averageDistanceMiles: { $avg: '$actualDistanceMiles' },
            averageFare: { $avg: '$fareEstimate' },
            totalPlatformCommission: { $sum: '$platformCommission' },
          },
        },
      ]),
    ]);

    const durationMetrics = durationAggregation[0] || {};
    const completionRate = totalTrips > 0 ? Number(((completedTrips / totalTrips) * 100).toFixed(2)) : 0;
    const cancellationRate = totalTrips > 0 ? Number(((cancelledTrips / totalTrips) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      window: {
        from: fromDate,
        to: toDate,
      },
      trips: {
        totalTrips,
        completedTrips,
        cancelledTrips,
        activeTrips,
        completionRate,
        cancellationRate,
        completedWithoutReceipt,
      },
      operations: {
        activeDrivers,
        pendingDriverApprovals,
        rejectedDrivers,
        openComplaints,
        resolvedComplaints,
        openSafetyIncidents,
        criticalSafetyIncidents,
        expiringOrExpiredDriverDocuments,
      },
      averages: {
        durationMinutes: Number(Number(durationMetrics.averageDurationMinutes || 0).toFixed(2)),
        distanceMiles: Number(Number(durationMetrics.averageDistanceMiles || 0).toFixed(2)),
        fare: Number(Number(durationMetrics.averageFare || 0).toFixed(2)),
      },
      finance: {
        totalPlatformCommission: Number(Number(durationMetrics.totalPlatformCommission || 0).toFixed(2)),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to generate compliance report.' });
  }
}

module.exports = {
  listTrips,
  getTripMonitoringMap,
  getComplianceReport,
};
