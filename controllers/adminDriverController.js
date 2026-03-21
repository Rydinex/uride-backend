const Driver = require('../models/Driver');
const { createDriverLog, createSafetyLog } = require('../services/complianceLogService');
const {
  evaluateDriverChicagoRequirements,
  normalizeDocType,
  VEHICLE_INSPECTION_DOC_TYPES,
} = require('../services/complianceReportingService');

const VEHICLE_INSPECTION_DOC_TYPE_SET = new Set(VEHICLE_INSPECTION_DOC_TYPES.map(normalizeDocType));

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

function findLatestDocumentIndex(driver, normalizedDocType) {
  const docs = Array.isArray(driver?.docs) ? driver.docs : [];
  let latestIndex = -1;
  let latestUploadedAt = 0;

  docs.forEach((doc, index) => {
    if (normalizeDocType(doc?.docType) !== normalizedDocType) {
      return;
    }

    const uploadedAt = parseDate(doc?.uploadedAt)?.getTime() || 0;
    if (latestIndex === -1 || uploadedAt >= latestUploadedAt) {
      latestIndex = index;
      latestUploadedAt = uploadedAt;
    }
  });

  return latestIndex;
}

async function listDrivers(req, res) {
  try {
    const { status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const drivers = await Driver.find(query)
      .select('name phone email status docs rejectionReason createdAt vehicle')
      .populate('vehicle')
      .sort({ createdAt: -1 });

    return res.status(200).json(drivers);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch drivers.' });
  }
}

async function reviewDriver(req, res) {
  try {
    const { driverId } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'." });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const previousStatus = driver.status;

    if (action === 'approve') {
      const complianceProfile = evaluateDriverChicagoRequirements(driver, {
        now: new Date(),
      });

      if (!complianceProfile.isCompliant) {
        await createDriverLog({
          driver: driver._id,
          eventType: 'driver_approval_blocked_compliance',
          actorType: 'admin',
          actorId: req.admin?.email || 'admin',
          severity: 'warning',
          metadata: {
            missingRequirements: complianceProfile.missingRequirements,
            requiredRequirementCount: complianceProfile.requiredRequirementCount,
            compliantRequirementCount: complianceProfile.compliantRequirementCount,
          },
        }).catch(() => null);

        await createSafetyLog({
          incidentType: 'driver_compliance_block',
          severity: 'medium',
          status: 'open',
          driver: driver._id,
          reportedByType: 'admin',
          reportedById: req.admin?.email || 'admin',
          title: 'Driver approval blocked by compliance requirements',
          description: `Missing requirements: ${complianceProfile.missingRequirements.join(', ') || 'unknown'}`,
          metadata: {
            missingRequirements: complianceProfile.missingRequirements,
          },
        }).catch(() => null);

        return res.status(400).json({
          message: 'Driver cannot be approved until all Chicago TNP compliance requirements are satisfied.',
          compliance: complianceProfile,
        });
      }

      driver.status = 'approved';
      driver.rejectionReason = null;
    } else {
      driver.status = 'rejected';
      driver.rejectionReason = rejectionReason || 'Rejected by admin.';
    }

    await driver.save();

    await createDriverLog({
      driver: driver._id,
      eventType: action === 'approve' ? 'driver_approved' : 'driver_rejected',
      actorType: 'admin',
      actorId: req.admin?.email || 'admin',
      severity: action === 'approve' ? 'info' : 'warning',
      metadata: {
        statusFrom: previousStatus,
        statusTo: driver.status,
        rejectionReason: driver.rejectionReason,
        complianceVerifiedAt: action === 'approve' ? new Date() : null,
      },
    }).catch(() => null);

    if (action === 'reject') {
      await createSafetyLog({
        incidentType: 'driver_onboarding_rejection',
        severity: 'medium',
        status: 'open',
        driver: driver._id,
        reportedByType: 'admin',
        reportedById: req.admin?.email || 'admin',
        title: 'Driver rejected during onboarding review',
        description: driver.rejectionReason || 'Rejected by admin.',
        metadata: {
          statusFrom: previousStatus,
          statusTo: driver.status,
        },
      }).catch(() => null);
    }

    return res.status(200).json({
      message: `Driver ${action}d successfully.`,
      driver: {
        id: driver._id,
        status: driver.status,
        rejectionReason: driver.rejectionReason,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to review driver.' });
  }
}

async function reviewDriverDocument(req, res) {
  try {
    const { driverId } = req.params;
    const { docType, status, expiresAt = undefined } = req.body;

    const normalizedDocType = normalizeDocType(docType);
    const normalizedStatus = String(status || '').trim().toLowerCase();

    if (!normalizedDocType) {
      return res.status(400).json({ message: 'docType is required.' });
    }

    if (!['pending', 'approved', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ message: "status must be one of: pending, approved, rejected." });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const latestDocIndex = findLatestDocumentIndex(driver, normalizedDocType);
    if (latestDocIndex < 0) {
      return res.status(404).json({ message: `No document found for docType '${docType}'.` });
    }

    const documentRecord = driver.docs[latestDocIndex];
    const previousStatus = String(documentRecord.status || 'pending').toLowerCase();

    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === '') {
        documentRecord.expiresAt = null;
      } else {
        const parsedExpiresAt = parseDate(expiresAt);
        if (!parsedExpiresAt) {
          return res.status(400).json({ message: 'expiresAt must be a valid date string.' });
        }

        documentRecord.expiresAt = parsedExpiresAt;
      }
    }

    documentRecord.status = normalizedStatus;

    if (VEHICLE_INSPECTION_DOC_TYPE_SET.has(normalizedDocType)) {
      driver.vehicleInspection = {
        ...(driver.vehicleInspection || {}),
        status: normalizedStatus,
        expiresAt: documentRecord.expiresAt || driver.vehicleInspection?.expiresAt || null,
        uploadedAt: driver.vehicleInspection?.uploadedAt || documentRecord.uploadedAt || new Date(),
      };
    }

    await driver.save();

    const complianceProfile = evaluateDriverChicagoRequirements(driver, {
      now: new Date(),
    });

    await createDriverLog({
      driver: driver._id,
      eventType: 'driver_document_reviewed',
      actorType: 'admin',
      actorId: req.admin?.email || 'admin',
      severity: normalizedStatus === 'rejected' ? 'warning' : 'info',
      metadata: {
        docType: documentRecord.docType,
        statusFrom: previousStatus,
        statusTo: normalizedStatus,
        expiresAt: documentRecord.expiresAt || null,
      },
    }).catch(() => null);

    if (normalizedStatus === 'rejected') {
      await createSafetyLog({
        incidentType: 'driver_document_rejected',
        severity: 'medium',
        status: 'open',
        driver: driver._id,
        reportedByType: 'admin',
        reportedById: req.admin?.email || 'admin',
        title: 'Driver document rejected',
        description: `${documentRecord.docType} was rejected during compliance review.`,
        metadata: {
          docType: documentRecord.docType,
          statusFrom: previousStatus,
          statusTo: normalizedStatus,
        },
      }).catch(() => null);
    }

    return res.status(200).json({
      message: 'Driver document review updated successfully.',
      document: {
        docType: documentRecord.docType,
        status: documentRecord.status,
        uploadedAt: documentRecord.uploadedAt,
        expiresAt: documentRecord.expiresAt,
      },
      compliance: complianceProfile,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to review driver document.' });
  }
}

async function getDriverComplianceStatus(req, res) {
  try {
    const { driverId } = req.params;
    const driver = await Driver.findById(driverId)
      .select('name phone email status operatingStates docs chauffeurLicense vehicleInspection')
      .lean();

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const compliance = evaluateDriverChicagoRequirements(driver, {
      now: new Date(),
    });

    return res.status(200).json(compliance);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch driver compliance status.' });
  }
}

module.exports = {
  listDrivers,
  reviewDriver,
  reviewDriverDocument,
  getDriverComplianceStatus,
};
