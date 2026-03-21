const TripLog = require('../models/TripLog');
const DriverLog = require('../models/DriverLog');
const SafetyLog = require('../models/SafetyLog');
const Complaint = require('../models/Complaint');
const Driver = require('../models/Driver');
const {
  buildSafetyReport,
  buildAirportOperationsReport,
  buildChicagoTnpComplianceReport,
} = require('../services/complianceReportingService');

const DEFAULT_DOC_ALERT_DAYS = Number(process.env.COMPLIANCE_DOC_EXPIRY_ALERT_DAYS || 30);
const EXPORT_MAX_LIMIT = Number(process.env.COMPLIANCE_EXPORT_MAX_LIMIT || 5000);

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

function toCsvValue(value) {
  if (value === null || value === undefined) {
    return '""';
  }

  const normalized =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);

  return `"${String(normalized).replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(toCsvValue).join(',');
  const dataLines = rows.map(row => headers.map(header => toCsvValue(row[header])).join(','));

  return [headerLine, ...dataLines].join('\n');
}

function applyDateRange(query, from, to, fieldName = 'createdAt') {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  if (!fromDate && !toDate) {
    return query;
  }

  query[fieldName] = {};
  if (fromDate) {
    query[fieldName].$gte = fromDate;
  }
  if (toDate) {
    query[fieldName].$lte = toDate;
  }

  return query;
}

async function listTripLogs(req, res) {
  try {
    const { tripId, driverId, riderId, eventType, severity, limit = 200, from, to } = req.query;

    const query = {};
    if (tripId) {
      query.trip = tripId;
    }
    if (driverId) {
      query.driver = driverId;
    }
    if (riderId) {
      query.rider = riderId;
    }
    if (eventType) {
      query.eventType = eventType;
    }
    if (severity) {
      query.severity = severity;
    }

    applyDateRange(query, from, to, 'occurredAt');

    const parsedLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);

    const logs = await TripLog.find(query)
      .populate('trip', '_id status')
      .populate('driver', 'name phone email')
      .populate('rider', 'name phone email')
      .sort({ occurredAt: -1 })
      .limit(parsedLimit);

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch trip logs.' });
  }
}

async function listDriverLogs(req, res) {
  try {
    const { driverId, tripId, eventType, severity, limit = 200, from, to } = req.query;

    const query = {};
    if (driverId) {
      query.driver = driverId;
    }
    if (tripId) {
      query.trip = tripId;
    }
    if (eventType) {
      query.eventType = eventType;
    }
    if (severity) {
      query.severity = severity;
    }

    applyDateRange(query, from, to, 'occurredAt');

    const parsedLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);

    const logs = await DriverLog.find(query)
      .populate('driver', 'name phone email status')
      .populate('trip', '_id status')
      .sort({ occurredAt: -1 })
      .limit(parsedLimit);

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch driver logs.' });
  }
}

async function listSafetyLogs(req, res) {
  try {
    const { status, severity, incidentType, limit = 200, from, to } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (severity) {
      query.severity = severity;
    }
    if (incidentType) {
      query.incidentType = incidentType;
    }

    applyDateRange(query, from, to, 'occurredAt');

    const parsedLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);

    const logs = await SafetyLog.find(query)
      .populate('trip', '_id status')
      .populate('driver', 'name phone email')
      .populate('rider', 'name phone email')
      .sort({ occurredAt: -1 })
      .limit(parsedLimit);

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch safety logs.' });
  }
}

async function listIncidentReports(req, res) {
  try {
    const { status, severity, limit = 100, from, to } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (severity) {
      query.severity = severity;
    }

    applyDateRange(query, from, to, 'createdAt');

    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const incidents = await SafetyLog.find(query)
      .populate('trip', '_id status pickup dropoff')
      .populate('driver', 'name phone email')
      .populate('rider', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(parsedLimit);

    return res.status(200).json(incidents);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch incident reports.' });
  }
}

async function updateIncidentReport(req, res) {
  try {
    const { incidentId } = req.params;
    const { status, resolutionNotes = '' } = req.body;

    if (!['open', 'investigating', 'resolved', 'dismissed'].includes(String(status))) {
      return res.status(400).json({ message: "status must be one of: open, investigating, resolved, dismissed." });
    }

    const incident = await SafetyLog.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ message: 'Incident report not found.' });
    }

    incident.status = status;
    incident.metadata = {
      ...(incident.metadata || {}),
      resolutionNotes: resolutionNotes || incident.metadata?.resolutionNotes || null,
      updatedBy: req.admin?.email || 'admin',
    };

    if (['resolved', 'dismissed'].includes(status)) {
      incident.resolvedAt = new Date();
      incident.resolvedBy = req.admin?.email || 'admin';
    }

    await incident.save();

    return res.status(200).json({
      message: 'Incident report updated successfully.',
      incident,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update incident report.' });
  }
}

async function getDocumentExpirationAlerts(req, res) {
  try {
    const thresholdDays = Math.min(Math.max(Number(req.query.thresholdDays) || DEFAULT_DOC_ALERT_DAYS, 1), 365);
    const now = new Date();
    const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);

    const drivers = await Driver.find({
      docs: {
        $elemMatch: {
          expiresAt: { $ne: null, $lte: thresholdDate },
        },
      },
    })
      .select('name phone email status docs')
      .sort({ createdAt: -1 });

    const alerts = [];

    for (const driver of drivers) {
      const docs = Array.isArray(driver.docs) ? driver.docs : [];
      for (const doc of docs) {
        if (!doc.expiresAt) {
          continue;
        }

        const expiresAt = new Date(doc.expiresAt);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt > thresholdDate) {
          continue;
        }

        const isExpired = expiresAt < now;
        const daysUntilExpiration = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        alerts.push({
          driverId: String(driver._id),
          driverName: driver.name,
          driverEmail: driver.email,
          driverPhone: driver.phone,
          driverStatus: driver.status,
          docType: doc.docType,
          docStatus: doc.status,
          expiresAt,
          isExpired,
          daysUntilExpiration,
          urgency: isExpired ? 'critical' : daysUntilExpiration <= 7 ? 'high' : 'medium',
        });
      }
    }

    alerts.sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime());

    return res.status(200).json({
      thresholdDays,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch document expiration alerts.' });
  }
}

async function getComplianceSummary(req, res) {
  try {
    const fromDate = parseDate(req.query.from) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = parseDate(req.query.to) || new Date();

    const dateFilter = {
      createdAt: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    const [
      totalComplaints,
      openComplaints,
      resolvedComplaints,
      totalIncidents,
      openIncidents,
      criticalIncidents,
      tripLogCount,
      driverLogCount,
      documentAlertCount,
    ] = await Promise.all([
      Complaint.countDocuments(dateFilter),
      Complaint.countDocuments({ ...dateFilter, status: { $in: ['open', 'in_review'] } }),
      Complaint.countDocuments({ ...dateFilter, status: 'resolved' }),
      SafetyLog.countDocuments(dateFilter),
      SafetyLog.countDocuments({ ...dateFilter, status: { $in: ['open', 'investigating'] } }),
      SafetyLog.countDocuments({ ...dateFilter, severity: { $in: ['high', 'critical'] } }),
      TripLog.countDocuments({ occurredAt: { $gte: fromDate, $lte: toDate } }),
      DriverLog.countDocuments({ occurredAt: { $gte: fromDate, $lte: toDate } }),
      Driver.countDocuments({
        docs: {
          $elemMatch: {
            expiresAt: { $ne: null, $lte: new Date(Date.now() + DEFAULT_DOC_ALERT_DAYS * 24 * 60 * 60 * 1000) },
          },
        },
      }),
    ]);

    return res.status(200).json({
      window: {
        from: fromDate,
        to: toDate,
      },
      complaints: {
        totalComplaints,
        openComplaints,
        resolvedComplaints,
      },
      incidents: {
        totalIncidents,
        openIncidents,
        criticalIncidents,
      },
      logs: {
        tripLogCount,
        driverLogCount,
      },
      documents: {
        upcomingOrExpiredWithin30Days: documentAlertCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch compliance summary.' });
  }
}

async function getSafetyReport(req, res) {
  try {
    const report = await buildSafetyReport({
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
    });

    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to generate safety report.' });
  }
}

async function getAirportOperationsReport(req, res) {
  try {
    const report = await buildAirportOperationsReport({
      from: req.query.from,
      to: req.query.to,
    });

    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to generate airport operations report.' });
  }
}

async function getChicagoTnpComplianceReport(req, res) {
  try {
    const report = await buildChicagoTnpComplianceReport({
      from: req.query.from,
      to: req.query.to,
    });

    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to generate Chicago TNP compliance report.' });
  }
}

async function exportComplianceData(req, res) {
  try {
    const { dataset = 'complaints', format = 'json', from, to, limit = 1000 } = req.query;
    const normalizedDataset = String(dataset).toLowerCase();
    const normalizedFormat = String(format).toLowerCase();
    const parsedLimit = Math.min(Math.max(Number(limit) || 1000, 1), EXPORT_MAX_LIMIT);

    const dateQuery = {};
    applyDateRange(dateQuery, from, to, 'createdAt');

    let rows = [];
    if (normalizedDataset === 'complaints') {
      rows = await Complaint.find(dateQuery).sort({ createdAt: -1 }).limit(parsedLimit).lean();
    } else if (normalizedDataset === 'safety_logs') {
      rows = await SafetyLog.find(dateQuery).sort({ createdAt: -1 }).limit(parsedLimit).lean();
    } else if (normalizedDataset === 'incident_reports') {
      rows = await SafetyLog.find(dateQuery).sort({ createdAt: -1 }).limit(parsedLimit).lean();
    } else if (normalizedDataset === 'trip_logs') {
      const tripDateQuery = {};
      applyDateRange(tripDateQuery, from, to, 'occurredAt');
      rows = await TripLog.find(tripDateQuery).sort({ occurredAt: -1 }).limit(parsedLimit).lean();
    } else if (normalizedDataset === 'driver_logs') {
      const driverDateQuery = {};
      applyDateRange(driverDateQuery, from, to, 'occurredAt');
      rows = await DriverLog.find(driverDateQuery).sort({ occurredAt: -1 }).limit(parsedLimit).lean();
    } else if (normalizedDataset === 'document_alerts') {
      const thresholdDays = Math.min(Math.max(Number(req.query.thresholdDays) || DEFAULT_DOC_ALERT_DAYS, 1), 365);
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);

      const drivers = await Driver.find({
        docs: {
          $elemMatch: {
            expiresAt: { $ne: null, $lte: thresholdDate },
          },
        },
      })
        .select('name phone email status docs')
        .limit(parsedLimit)
        .lean();

      rows = [];
      for (const driver of drivers) {
        const docs = Array.isArray(driver.docs) ? driver.docs : [];
        docs.forEach(doc => {
          if (!doc.expiresAt) {
            return;
          }

          const expiresAt = new Date(doc.expiresAt);
          if (Number.isNaN(expiresAt.getTime()) || expiresAt > thresholdDate) {
            return;
          }

          rows.push({
            driverId: String(driver._id),
            driverName: driver.name,
            driverEmail: driver.email,
            driverPhone: driver.phone,
            driverStatus: driver.status,
            docType: doc.docType,
            docStatus: doc.status,
            expiresAt,
            isExpired: expiresAt < now,
          });
        });
      }
    } else if (normalizedDataset === 'safety_report') {
      const report = await buildSafetyReport({
        from,
        to,
        limit: parsedLimit,
      });
      rows = [report];
    } else if (normalizedDataset === 'airport_report') {
      const report = await buildAirportOperationsReport({
        from,
        to,
      });
      rows = [report];
    } else if (normalizedDataset === 'chicago_tnp') {
      const report = await buildChicagoTnpComplianceReport({
        from,
        to,
      });
      rows = [report];
    } else {
      return res.status(400).json({
        message:
          'dataset must be one of: complaints, safety_logs, incident_reports, trip_logs, driver_logs, document_alerts, safety_report, airport_report, chicago_tnp.',
      });
    }

    if (normalizedFormat === 'csv') {
      const csvPayload = toCsv(rows);
      const fileName = `${normalizedDataset}_${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      return res.status(200).send(csvPayload);
    }

    if (normalizedFormat !== 'json') {
      return res.status(400).json({ message: "format must be 'json' or 'csv'." });
    }

    return res.status(200).json({
      dataset: normalizedDataset,
      format: normalizedFormat,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to export compliance data.' });
  }
}

module.exports = {
  listTripLogs,
  listDriverLogs,
  listSafetyLogs,
  listIncidentReports,
  updateIncidentReport,
  getDocumentExpirationAlerts,
  getComplianceSummary,
  getSafetyReport,
  getAirportOperationsReport,
  getChicagoTnpComplianceReport,
  exportComplianceData,
};
