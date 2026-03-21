const Complaint = require('../models/Complaint');
const Trip = require('../models/Trip');
const Driver = require('../models/Driver');
const Rider = require('../models/Rider');
const { createSafetyLog, createTripLog, createDriverLog } = require('../services/complianceLogService');

function parsePriority(value) {
  const allowed = ['low', 'medium', 'high', 'urgent'];
  if (!value || !allowed.includes(String(value))) {
    return 'medium';
  }
  return String(value);
}

async function createComplaint(req, res) {
  try {
    const {
      category,
      subject,
      description,
      tripId = null,
      riderId = null,
      driverId = null,
      submittedByType,
      submittedById,
      priority = 'medium',
      metadata = {},
    } = req.body;

    if (!category || !subject || !description || !submittedByType || !submittedById) {
      return res.status(400).json({
        message: 'category, subject, description, submittedByType and submittedById are required.',
      });
    }

    if (!['rider', 'driver', 'admin'].includes(String(submittedByType))) {
      return res.status(400).json({ message: "submittedByType must be 'rider', 'driver', or 'admin'." });
    }

    if (tripId) {
      const tripExists = await Trip.exists({ _id: tripId });
      if (!tripExists) {
        return res.status(404).json({ message: 'Referenced trip not found.' });
      }
    }

    if (driverId) {
      const driverExists = await Driver.exists({ _id: driverId });
      if (!driverExists) {
        return res.status(404).json({ message: 'Referenced driver not found.' });
      }
    }

    if (riderId) {
      const riderExists = await Rider.exists({ _id: riderId });
      if (!riderExists) {
        return res.status(404).json({ message: 'Referenced rider not found.' });
      }
    }

    const complaint = await Complaint.create({
      category,
      subject,
      description,
      trip: tripId || null,
      rider: riderId || null,
      driver: driverId || null,
      submittedByType,
      submittedById,
      priority: parsePriority(priority),
      metadata,
    });

    await Promise.all([
      createSafetyLog({
        incidentType: 'complaint',
        severity: complaint.priority === 'urgent' ? 'critical' : complaint.priority === 'high' ? 'high' : 'medium',
        status: 'open',
        trip: complaint.trip,
        rider: complaint.rider,
        driver: complaint.driver,
        reportedByType: submittedByType === 'admin' ? 'admin' : submittedByType,
        reportedById: submittedById,
        title: `Complaint: ${complaint.subject}`,
        description: complaint.description,
        metadata: {
          complaintId: complaint._id,
          category: complaint.category,
          priority: complaint.priority,
        },
      }),
      complaint.trip
        ? createTripLog({
            trip: complaint.trip,
            rider: complaint.rider,
            driver: complaint.driver,
            eventType: 'complaint_created',
            actorType: submittedByType === 'admin' ? 'admin' : submittedByType,
            actorId: submittedById,
            severity: complaint.priority === 'urgent' ? 'critical' : 'warning',
            metadata: {
              complaintId: complaint._id,
              category: complaint.category,
            },
          })
        : Promise.resolve(null),
      complaint.driver
        ? createDriverLog({
            driver: complaint.driver,
            trip: complaint.trip,
            eventType: 'complaint_created',
            actorType: submittedByType === 'admin' ? 'admin' : submittedByType === 'rider' ? 'system' : submittedByType,
            actorId: submittedById,
            severity: complaint.priority === 'urgent' ? 'critical' : 'warning',
            metadata: {
              complaintId: complaint._id,
              category: complaint.category,
            },
          })
        : Promise.resolve(null),
    ]);

    return res.status(201).json({
      message: 'Complaint submitted successfully.',
      complaint,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to submit complaint.' });
  }
}

async function listComplaints(req, res) {
  try {
    const { status, priority, category, limit = 100, from, to } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }
    if (category) {
      query.category = category;
    }

    if (from || to) {
      query.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) {
          query.createdAt.$gte = fromDate;
        }
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
          query.createdAt.$lte = toDate;
        }
      }
      if (Object.keys(query.createdAt).length === 0) {
        delete query.createdAt;
      }
    }

    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const complaints = await Complaint.find(query)
      .populate('trip', '_id status pickup dropoff')
      .populate('driver', 'name phone email')
      .populate('rider', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(parsedLimit);

    return res.status(200).json(complaints);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch complaints.' });
  }
}

async function updateComplaintStatus(req, res) {
  try {
    const { complaintId } = req.params;
    const { status, resolutionNotes = '', assignedTo = null } = req.body;

    if (!['open', 'in_review', 'resolved', 'dismissed'].includes(String(status))) {
      return res.status(400).json({ message: "status must be one of: open, in_review, resolved, dismissed." });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    complaint.status = status;
    complaint.assignedTo = assignedTo || complaint.assignedTo;
    if (resolutionNotes) {
      complaint.resolutionNotes = resolutionNotes;
    }

    if (['resolved', 'dismissed'].includes(status)) {
      complaint.resolvedAt = new Date();
    }

    await complaint.save();

    await Promise.all([
      createSafetyLog({
        incidentType: 'complaint_status_update',
        severity: status === 'resolved' ? 'low' : status === 'dismissed' ? 'low' : 'medium',
        status: status === 'resolved' ? 'resolved' : status === 'dismissed' ? 'dismissed' : 'investigating',
        trip: complaint.trip,
        rider: complaint.rider,
        driver: complaint.driver,
        reportedByType: 'admin',
        reportedById: req.admin?.email || 'admin',
        title: `Complaint ${status}`,
        description: resolutionNotes || `Complaint moved to ${status}.`,
        metadata: {
          complaintId: complaint._id,
          assignedTo: complaint.assignedTo,
        },
      }),
      complaint.trip
        ? createTripLog({
            trip: complaint.trip,
            rider: complaint.rider,
            driver: complaint.driver,
            eventType: 'complaint_status_updated',
            actorType: 'admin',
            actorId: req.admin?.email || 'admin',
            severity: status === 'resolved' ? 'info' : 'warning',
            metadata: {
              complaintId: complaint._id,
              complaintStatus: status,
            },
          })
        : Promise.resolve(null),
      complaint.driver
        ? createDriverLog({
            driver: complaint.driver,
            trip: complaint.trip,
            eventType: 'complaint_status_updated',
            actorType: 'admin',
            actorId: req.admin?.email || 'admin',
            severity: status === 'resolved' ? 'info' : 'warning',
            metadata: {
              complaintId: complaint._id,
              complaintStatus: status,
            },
          })
        : Promise.resolve(null),
    ]);

    return res.status(200).json({
      message: 'Complaint status updated successfully.',
      complaint,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update complaint status.' });
  }
}

module.exports = {
  createComplaint,
  listComplaints,
  updateComplaintStatus,
};
