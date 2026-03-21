const Driver = require('../models/Driver');
const Trip = require('../models/Trip');
const DriverLog = require('../models/DriverLog');
const TripLog = require('../models/TripLog');
const SafetyLog = require('../models/SafetyLog');
const Complaint = require('../models/Complaint');
const AirportQueueEntry = require('../models/AirportQueueEntry');
const {
  resolveStateRules,
  PREMIUM_RIDE_CATEGORIES,
  CHICAGO_PREMIUM_REQUIRED_DOCUMENTS,
} = require('./driverComplianceRules');

const BACKGROUND_CHECK_DOC_TYPES = [
  'background_check',
  'background_check_report',
  'background_screening',
  'criminal_background_check',
];

const INSURANCE_DOC_TYPES = [
  'insurance',
  'insurance_policy',
  'commercial_insurance',
  'tnp_insurance',
  'proof_of_insurance',
];

const COMMERCIAL_INSURANCE_DOC_TYPES = [
  'commercial_insurance',
  'tnp_insurance',
  'insurance_policy',
  'proof_of_insurance',
];

const STATE_DRIVER_LICENSE_DOC_TYPES = [
  'license',
  'state_driver_license',
  'state_issued_driver_license',
  'driver_license',
];

const VEHICLE_REGISTRATION_DOC_TYPES = [
  'vehicle_registration',
  'car_registration',
  'registration',
];

const PROFILE_PICTURE_DOC_TYPES = [
  'profile_picture',
  'driver_profile_photo',
  'profile_photo',
];

const HARD_CARD_DOC_TYPES = [
  'hard_card',
  'chauffeur_hard_card',
  'taxi_hard_card',
];

const CHAUFFEUR_CREDENTIAL_DOC_TYPES = [
  'chauffeur_license',
  'city_chauffeur_license',
  'taxi_chauffeur_license',
];

const VEHICLE_INSPECTION_DOC_TYPES = [
  'vehicle_inspection',
  'inspection_report',
  'tnp_vehicle_inspection',
];

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

function normalizeDocType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeDocStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['approved', 'pending', 'rejected'].includes(normalized)) {
    return normalized;
  }

  return 'pending';
}

function toPercent(value, total) {
  if (!Number.isFinite(Number(total)) || Number(total) <= 0) {
    return 100;
  }

  return Number(((Number(value || 0) / Number(total)) * 100).toFixed(2));
}

function toDateFilter(fieldName, fromDate, toDate) {
  return {
    [fieldName]: {
      $gte: fromDate,
      $lte: toDate,
    },
  };
}

function resolveReportWindow({ from = null, to = null, defaultDays = 30 } = {}) {
  const now = new Date();
  const parsedFrom = parseDate(from);
  const parsedTo = parseDate(to);

  const toDate = parsedTo || now;
  const fromDate = parsedFrom || new Date(toDate.getTime() - Number(defaultDays || 30) * 24 * 60 * 60 * 1000);

  if (fromDate.getTime() <= toDate.getTime()) {
    return { fromDate, toDate };
  }

  return {
    fromDate: toDate,
    toDate: fromDate,
  };
}

function dateIsExpired(value, now = new Date()) {
  const parsed = parseDate(value);
  if (!parsed) {
    return false;
  }

  return parsed.getTime() < now.getTime();
}

function findLatestDriverDoc(driver, docTypeCandidates = []) {
  const docs = Array.isArray(driver?.docs) ? driver.docs : [];
  const normalizedCandidates = new Set(docTypeCandidates.map(normalizeDocType));

  let latestDoc = null;
  let latestUploadedAt = 0;

  for (const doc of docs) {
    if (!normalizedCandidates.has(normalizeDocType(doc?.docType))) {
      continue;
    }

    const uploadedAt = parseDate(doc?.uploadedAt)?.getTime() || 0;
    if (!latestDoc || uploadedAt >= latestUploadedAt) {
      latestDoc = doc;
      latestUploadedAt = uploadedAt;
    }
  }

  return latestDoc;
}

function buildRequirementResult({
  requirementKey,
  label,
  required = true,
  status = 'missing',
  isCompliant = false,
  message = '',
  evidence = null,
}) {
  return {
    requirementKey,
    label,
    required,
    status,
    isCompliant: Boolean(isCompliant),
    message,
    evidence,
  };
}

function toOptionalRequirement(requirement, { required, notRequiredMessage, evidence = null }) {
  if (required) {
    return requirement;
  }

  return buildRequirementResult({
    requirementKey: requirement.requirementKey,
    label: requirement.label,
    required: false,
    status: 'not_required',
    isCompliant: true,
    message: notRequiredMessage,
    evidence,
  });
}

function resolveAlternativeRequirementStatus(statuses = []) {
  const normalizedStatuses = statuses
    .map(status => String(status || '').trim().toLowerCase())
    .filter(Boolean);

  if (normalizedStatuses.includes('pending')) {
    return 'pending';
  }

  if (normalizedStatuses.includes('expired')) {
    return 'expired';
  }

  if (normalizedStatuses.includes('rejected')) {
    return 'rejected';
  }

  return 'missing';
}

function requiresChicagoPremiumCompliance(driver) {
  const resolvedStates = resolveStateRules(driver?.operatingStates || ['IL']);
  return resolvedStates.operatingStates.includes('IL');
}

function evaluateDocumentRequirement({
  driver,
  requirementKey,
  label,
  docTypeCandidates,
  now = new Date(),
}) {
  const latestDoc = findLatestDriverDoc(driver, docTypeCandidates);

  if (!latestDoc) {
    return buildRequirementResult({
      requirementKey,
      label,
      required: true,
      status: 'missing',
      isCompliant: false,
      message: `No ${label.toLowerCase()} document found.`,
      evidence: null,
    });
  }

  const docStatus = normalizeDocStatus(latestDoc.status);
  const expiresAt = parseDate(latestDoc.expiresAt);
  const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() : false;

  if (docStatus === 'approved' && !isExpired) {
    return buildRequirementResult({
      requirementKey,
      label,
      required: true,
      status: 'compliant',
      isCompliant: true,
      message: `${label} is verified.`,
      evidence: {
        docType: latestDoc.docType,
        status: docStatus,
        uploadedAt: latestDoc.uploadedAt || null,
        expiresAt,
      },
    });
  }

  if (docStatus === 'approved' && isExpired) {
    return buildRequirementResult({
      requirementKey,
      label,
      required: true,
      status: 'expired',
      isCompliant: false,
      message: `${label} document is expired.`,
      evidence: {
        docType: latestDoc.docType,
        status: docStatus,
        uploadedAt: latestDoc.uploadedAt || null,
        expiresAt,
      },
    });
  }

  if (docStatus === 'rejected') {
    return buildRequirementResult({
      requirementKey,
      label,
      required: true,
      status: 'rejected',
      isCompliant: false,
      message: `${label} document was rejected.`,
      evidence: {
        docType: latestDoc.docType,
        status: docStatus,
        uploadedAt: latestDoc.uploadedAt || null,
        expiresAt,
      },
    });
  }

  return buildRequirementResult({
    requirementKey,
    label,
    required: true,
    status: 'pending',
    isCompliant: false,
    message: `${label} verification is pending.`,
    evidence: {
      docType: latestDoc.docType,
      status: docStatus,
      uploadedAt: latestDoc.uploadedAt || null,
      expiresAt,
    },
  });
}

function evaluateVehicleInspectionRequirement(driver, now = new Date()) {
  const inspection = driver?.vehicleInspection || {};
  const status = String(inspection.status || 'not_uploaded').trim().toLowerCase();
  const expiresAt = parseDate(inspection.expiresAt);
  const inspectionEvidence = {
    source: 'vehicleInspection',
    status,
    uploadedAt: parseDate(inspection.uploadedAt),
    expiresAt,
    inspectionCenter: inspection.inspectionCenter || '',
  };

  if (status === 'approved') {
    if (dateIsExpired(expiresAt, now)) {
      return buildRequirementResult({
        requirementKey: 'vehicleInspection',
        label: 'Vehicle Inspection',
        required: true,
        status: 'expired',
        isCompliant: false,
        message: 'Vehicle inspection is expired.',
        evidence: inspectionEvidence,
      });
    }

    return buildRequirementResult({
      requirementKey: 'vehicleInspection',
      label: 'Vehicle Inspection',
      required: true,
      status: 'compliant',
      isCompliant: true,
      message: 'Vehicle inspection is approved.',
      evidence: inspectionEvidence,
    });
  }

  if (status === 'rejected') {
    return buildRequirementResult({
      requirementKey: 'vehicleInspection',
      label: 'Vehicle Inspection',
      required: true,
      status: 'rejected',
      isCompliant: false,
      message: 'Vehicle inspection was rejected.',
      evidence: inspectionEvidence,
    });
  }

  if (status === 'pending') {
    return buildRequirementResult({
      requirementKey: 'vehicleInspection',
      label: 'Vehicle Inspection',
      required: true,
      status: 'pending',
      isCompliant: false,
      message: 'Vehicle inspection verification is pending.',
      evidence: inspectionEvidence,
    });
  }

  return evaluateDocumentRequirement({
    driver,
    requirementKey: 'vehicleInspection',
    label: 'Vehicle Inspection',
    docTypeCandidates: VEHICLE_INSPECTION_DOC_TYPES,
    now,
  });
}

function evaluateChauffeurLicenseRequirement(driver, now = new Date()) {
  const resolvedStates = resolveStateRules(driver?.operatingStates || ['IL']);
  const requiresChauffeurLicense = resolvedStates.rules.some(rule => Boolean(rule.chauffeurLicenseRequired));

  if (!requiresChauffeurLicense) {
    return buildRequirementResult({
      requirementKey: 'chauffeurLicense',
      label: 'Chauffeur License',
      required: false,
      status: 'not_required',
      isCompliant: true,
      message: 'Chauffeur license is not required for selected operating states.',
      evidence: {
        operatingStates: resolvedStates.operatingStates,
      },
    });
  }

  const license = driver?.chauffeurLicense || {};
  const status = String(license.status || 'unverified').trim().toLowerCase();
  const expiresAt = parseDate(license.expiresAt);
  const chauffeurCredentialDocument = evaluateDocumentRequirement({
    driver,
    requirementKey: 'chauffeurCredentialDocument',
    label: 'City Chauffeur / Taxi Chauffeur Credential',
    docTypeCandidates: CHAUFFEUR_CREDENTIAL_DOC_TYPES,
    now,
  });

  if ((status === 'verified' && !dateIsExpired(expiresAt, now)) || chauffeurCredentialDocument.isCompliant) {
    return buildRequirementResult({
      requirementKey: 'chauffeurLicense',
      label: 'Chauffeur License',
      required: true,
      status: 'compliant',
      isCompliant: true,
      message: 'Chauffeur credential is verified for premium service.',
      evidence: {
        licenseVerification: {
          licenseNumber: license.licenseNumber || null,
          issuingState: license.issuingState || null,
          status,
          verifiedAt: parseDate(license.verifiedAt),
          expiresAt,
        },
        chauffeurDocument: chauffeurCredentialDocument.evidence,
      },
    });
  }

  const licenseStatus =
    status === 'verified' && dateIsExpired(expiresAt, now)
      ? 'expired'
      : status === 'rejected'
      ? 'rejected'
      : status === 'pending'
      ? 'pending'
      : 'missing';

  const combinedStatus = resolveAlternativeRequirementStatus([licenseStatus, chauffeurCredentialDocument.status]);

  const statusToMessage = {
    pending: 'Chauffeur or taxi chauffeur credential verification is pending.',
    expired: 'Chauffeur or taxi chauffeur credential is expired.',
    rejected: 'Chauffeur or taxi chauffeur credential was rejected.',
    missing: 'No verified chauffeur or taxi chauffeur credential found.',
  };

  return buildRequirementResult({
    requirementKey: 'chauffeurLicense',
    label: 'Chauffeur License',
    required: true,
    status: combinedStatus,
    isCompliant: false,
    message: statusToMessage[combinedStatus] || statusToMessage.missing,
    evidence: {
      licenseVerification: {
        licenseNumber: license.licenseNumber || null,
        issuingState: license.issuingState || null,
        status,
        expiresAt,
      },
      chauffeurDocument: chauffeurCredentialDocument.evidence,
    },
  });
}

function evaluateDriverChicagoRequirements(driver, { now = new Date() } = {}) {
  const premiumComplianceRequired = requiresChicagoPremiumCompliance(driver);

  const backgroundCheck = evaluateDocumentRequirement({
    driver,
    requirementKey: 'backgroundCheck',
    label: 'Background Check',
    docTypeCandidates: BACKGROUND_CHECK_DOC_TYPES,
    now,
  });

  const vehicleInspection = evaluateVehicleInspectionRequirement(driver, now);

  const insuranceVerification = evaluateDocumentRequirement({
    driver,
    requirementKey: 'insuranceVerification',
    label: 'Insurance Verification',
    docTypeCandidates: INSURANCE_DOC_TYPES,
    now,
  });

  const stateDriverLicense = toOptionalRequirement(
    evaluateDocumentRequirement({
      driver,
      requirementKey: 'stateDriverLicense',
      label: 'State-Issued Driver License',
      docTypeCandidates: STATE_DRIVER_LICENSE_DOC_TYPES,
      now,
    }),
    {
      required: premiumComplianceRequired,
      notRequiredMessage: 'State-issued driver license check is only required for Chicago premium service.',
      evidence: {
        premiumRideCategories: PREMIUM_RIDE_CATEGORIES,
      },
    }
  );

  const commercialInsurance = toOptionalRequirement(
    evaluateDocumentRequirement({
      driver,
      requirementKey: 'commercialInsurance',
      label: 'Commercial Insurance',
      docTypeCandidates: COMMERCIAL_INSURANCE_DOC_TYPES,
      now,
    }),
    {
      required: premiumComplianceRequired,
      notRequiredMessage: 'Commercial insurance check is only required for Chicago premium service.',
      evidence: {
        premiumRideCategories: PREMIUM_RIDE_CATEGORIES,
      },
    }
  );

  const vehicleRegistration = toOptionalRequirement(
    evaluateDocumentRequirement({
      driver,
      requirementKey: 'vehicleRegistration',
      label: 'Vehicle Registration',
      docTypeCandidates: VEHICLE_REGISTRATION_DOC_TYPES,
      now,
    }),
    {
      required: premiumComplianceRequired,
      notRequiredMessage: 'Vehicle registration check is only required for Chicago premium service.',
      evidence: {
        premiumRideCategories: PREMIUM_RIDE_CATEGORIES,
      },
    }
  );

  const profilePicture = toOptionalRequirement(
    evaluateDocumentRequirement({
      driver,
      requirementKey: 'profilePicture',
      label: 'Profile Picture',
      docTypeCandidates: PROFILE_PICTURE_DOC_TYPES,
      now,
    }),
    {
      required: premiumComplianceRequired,
      notRequiredMessage: 'Profile picture check is only required for Chicago premium service.',
      evidence: {
        premiumRideCategories: PREMIUM_RIDE_CATEGORIES,
      },
    }
  );

  const hardCard = toOptionalRequirement(
    evaluateDocumentRequirement({
      driver,
      requirementKey: 'hardCard',
      label: 'Chauffeur Hard Card',
      docTypeCandidates: HARD_CARD_DOC_TYPES,
      now,
    }),
    {
      required: premiumComplianceRequired,
      notRequiredMessage: 'Hard card check is only required for Chicago premium service.',
      evidence: {
        premiumRideCategories: PREMIUM_RIDE_CATEGORIES,
      },
    }
  );

  const chauffeurLicense = evaluateChauffeurLicenseRequirement(driver, now);

  const requirements = {
    backgroundCheck,
    vehicleInspection,
    insuranceVerification,
    stateDriverLicense,
    commercialInsurance,
    vehicleRegistration,
    profilePicture,
    hardCard,
    chauffeurLicense,
  };

  const requiredRequirements = Object.values(requirements).filter(requirement => requirement.required);
  const nonCompliantRequirements = requiredRequirements.filter(requirement => !requirement.isCompliant);

  return {
    driverId: driver?._id ? String(driver._id) : null,
    driverName: driver?.name || null,
    driverEmail: driver?.email || null,
    driverStatus: driver?.status || 'pending',
    operatingStates: Array.isArray(driver?.operatingStates) ? driver.operatingStates : [],
    requirements,
    isCompliant: nonCompliantRequirements.length === 0,
    missingRequirements: nonCompliantRequirements.map(requirement => requirement.requirementKey),
    requiredRequirementCount: requiredRequirements.length,
    compliantRequirementCount: requiredRequirements.length - nonCompliantRequirements.length,
    serviceLevels: {
      premium: {
        rideCategories: PREMIUM_RIDE_CATEGORIES,
        chicagoComplianceRequired: premiumComplianceRequired,
        requiredDocuments: premiumComplianceRequired ? CHICAGO_PREMIUM_REQUIRED_DOCUMENTS : [],
        isEligible: nonCompliantRequirements.length === 0,
      },
    },
  };
}

function summarizeDriverRequirementProfiles(driverProfiles, requirementKey) {
  let totalDrivers = 0;
  let compliantDrivers = 0;
  let pending = 0;
  let rejected = 0;
  let missing = 0;
  let expired = 0;

  for (const profile of driverProfiles) {
    const requirement = profile?.requirements?.[requirementKey];
    if (!requirement || !requirement.required) {
      continue;
    }

    totalDrivers += 1;

    if (requirement.isCompliant) {
      compliantDrivers += 1;
      continue;
    }

    if (requirement.status === 'pending') {
      pending += 1;
    } else if (requirement.status === 'rejected') {
      rejected += 1;
    } else if (requirement.status === 'expired') {
      expired += 1;
    } else {
      missing += 1;
    }
  }

  const complianceRate = toPercent(compliantDrivers, totalDrivers);

  return {
    totalDrivers,
    compliantDrivers,
    nonCompliantDrivers: Math.max(totalDrivers - compliantDrivers, 0),
    pending,
    rejected,
    missing,
    expired,
    complianceRate,
    status: complianceRate >= 99.99 ? 'pass' : complianceRate >= 90 ? 'warning' : 'action_required',
  };
}

async function buildChicagoTnpComplianceReport({ from = null, to = null } = {}) {
  const { fromDate, toDate } = resolveReportWindow({ from, to, defaultDays: 30 });

  const tripDateFilter = toDateFilter('createdAt', fromDate, toDate);
  const complaintDateFilter = toDateFilter('createdAt', fromDate, toDate);
  const logDateFilter = toDateFilter('occurredAt', fromDate, toDate);

  const [
    allDrivers,
    totalTrips,
    completedTrips,
    tripsWithReceipts,
    transparentFareTrips,
    transparentSurgeTrips,
    totalComplaints,
    resolvedComplaints,
    openComplaints,
    tripLogCount,
    driverLogCount,
    safetyLogCount,
  ] = await Promise.all([
    Driver.find({ createdAt: { $lte: toDate } })
      .select('name email status operatingStates docs chauffeurLicense vehicleInspection')
      .lean(),
    Trip.countDocuments(tripDateFilter),
    Trip.countDocuments({ ...tripDateFilter, status: 'completed' }),
    Trip.countDocuments({ ...tripDateFilter, status: 'completed', receipt: { $ne: null } }),
    Trip.countDocuments({ ...tripDateFilter, upfrontFare: { $ne: null }, pricingBreakdown: { $ne: null } }),
    Trip.countDocuments({ ...tripDateFilter, surgeMultiplier: { $ne: null }, demandRatio: { $ne: null } }),
    Complaint.countDocuments(complaintDateFilter),
    Complaint.countDocuments({ ...complaintDateFilter, status: 'resolved' }),
    Complaint.countDocuments({ ...complaintDateFilter, status: { $in: ['open', 'in_review'] } }),
    TripLog.countDocuments(logDateFilter),
    DriverLog.countDocuments(logDateFilter),
    SafetyLog.countDocuments(logDateFilter),
  ]);

  const approvedDrivers = allDrivers.filter(driver => String(driver.status) === 'approved');
  const driversConsidered = approvedDrivers.length ? approvedDrivers : allDrivers;
  const profiles = driversConsidered.map(driver => evaluateDriverChicagoRequirements(driver, { now: toDate }));

  const backgroundChecks = summarizeDriverRequirementProfiles(profiles, 'backgroundCheck');
  const vehicleInspections = summarizeDriverRequirementProfiles(profiles, 'vehicleInspection');
  const insuranceVerification = summarizeDriverRequirementProfiles(profiles, 'insuranceVerification');
  const stateDriverLicenseVerification = summarizeDriverRequirementProfiles(profiles, 'stateDriverLicense');
  const commercialInsuranceVerification = summarizeDriverRequirementProfiles(profiles, 'commercialInsurance');
  const vehicleRegistrationVerification = summarizeDriverRequirementProfiles(profiles, 'vehicleRegistration');
  const profilePictureVerification = summarizeDriverRequirementProfiles(profiles, 'profilePicture');
  const hardCardVerification = summarizeDriverRequirementProfiles(profiles, 'hardCard');

  const fareTransparencyRate = toPercent(transparentFareTrips, totalTrips);
  const surgeTransparencyRate = toPercent(transparentSurgeTrips, totalTrips);
  const receiptCoverageRate = toPercent(tripsWithReceipts, completedTrips);
  const complaintResolutionRate = toPercent(resolvedComplaints, totalComplaints);

  const overallScore = Number(
    (
      (
        backgroundChecks.complianceRate +
        vehicleInspections.complianceRate +
        insuranceVerification.complianceRate +
        stateDriverLicenseVerification.complianceRate +
        commercialInsuranceVerification.complianceRate +
        vehicleRegistrationVerification.complianceRate +
        profilePictureVerification.complianceRate +
        hardCardVerification.complianceRate +
        fareTransparencyRate +
        surgeTransparencyRate +
        receiptCoverageRate +
        complaintResolutionRate
      ) /
      12
    ).toFixed(2)
  );

  return {
    generatedAt: new Date(),
    window: {
      from: fromDate,
      to: toDate,
    },
    driverPopulation: {
      totalDrivers: allDrivers.length,
      approvedDrivers: approvedDrivers.length,
      driversConsidered: driversConsidered.length,
    },
    legalRequirements: {
      backgroundChecks,
      vehicleInspections,
      insuranceVerification,
      stateDriverLicenseVerification,
      commercialInsuranceVerification,
      vehicleRegistrationVerification,
      profilePictureVerification,
      hardCardVerification,
      fareTransparency: {
        transparentTrips: transparentFareTrips,
        totalTrips,
        transparencyRate: fareTransparencyRate,
        status: fareTransparencyRate >= 99.99 ? 'pass' : fareTransparencyRate >= 90 ? 'warning' : 'action_required',
      },
      surgeTransparency: {
        transparentTrips: transparentSurgeTrips,
        totalTrips,
        transparencyRate: surgeTransparencyRate,
        status: surgeTransparencyRate >= 99.99 ? 'pass' : surgeTransparencyRate >= 90 ? 'warning' : 'action_required',
      },
      tripReceipts: {
        completedTrips,
        tripsWithReceipts,
        receiptCoverageRate,
        status: receiptCoverageRate >= 99.99 ? 'pass' : receiptCoverageRate >= 95 ? 'warning' : 'action_required',
      },
      complaintSystem: {
        totalComplaints,
        openComplaints,
        resolvedComplaints,
        complaintResolutionRate,
        status: 'operational',
      },
    },
    generatedArtifacts: {
      tripLogs: tripLogCount,
      driverLogs: driverLogCount,
      safetyReports: safetyLogCount,
      incidentReports: safetyLogCount,
      airportReports: {
        endpoint: '/api/admin/compliance/reports/airport',
        available: true,
      },
      dataExports: {
        endpoint: '/api/admin/compliance/export',
        formats: ['json', 'csv'],
      },
    },
    overallCompliance: {
      score: overallScore,
      status: overallScore >= 95 ? 'pass' : overallScore >= 85 ? 'warning' : 'action_required',
    },
  };
}

async function buildSafetyReport({ from = null, to = null, limit = 100 } = {}) {
  const { fromDate, toDate } = resolveReportWindow({ from, to, defaultDays: 30 });
  const occurredAtFilter = toDateFilter('occurredAt', fromDate, toDate);
  const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);

  const [severityBreakdown, statusBreakdown, incidentTypeBreakdown, totalIncidents, openIncidents, recentIncidents] = await Promise.all([
    SafetyLog.aggregate([
      { $match: occurredAtFilter },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    SafetyLog.aggregate([
      { $match: occurredAtFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    SafetyLog.aggregate([
      { $match: occurredAtFilter },
      { $group: { _id: '$incidentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 25 },
    ]),
    SafetyLog.countDocuments(occurredAtFilter),
    SafetyLog.countDocuments({ ...occurredAtFilter, status: { $in: ['open', 'investigating'] } }),
    SafetyLog.find(occurredAtFilter)
      .populate('trip', '_id status')
      .populate('driver', 'name phone email')
      .populate('rider', 'name phone email')
      .sort({ occurredAt: -1 })
      .limit(parsedLimit),
  ]);

  const criticalOpenIncidents = await SafetyLog.countDocuments({
    ...occurredAtFilter,
    status: { $in: ['open', 'investigating'] },
    severity: { $in: ['high', 'critical'] },
  });

  return {
    generatedAt: new Date(),
    window: {
      from: fromDate,
      to: toDate,
    },
    totals: {
      totalIncidents,
      openIncidents,
      criticalOpenIncidents,
    },
    severityBreakdown: severityBreakdown.map(item => ({ severity: item._id || 'unknown', count: item.count })),
    statusBreakdown: statusBreakdown.map(item => ({ status: item._id || 'unknown', count: item.count })),
    incidentTypeBreakdown: incidentTypeBreakdown.map(item => ({ incidentType: item._id || 'unknown', count: item.count })),
    recentIncidents,
  };
}

async function buildAirportOperationsReport({ from = null, to = null } = {}) {
  const { fromDate, toDate } = resolveReportWindow({ from, to, defaultDays: 30 });

  const tripDateFilter = toDateFilter('createdAt', fromDate, toDate);
  const queueDateFilter = toDateFilter('joinedAt', fromDate, toDate);
  const logDateFilter = toDateFilter('occurredAt', fromDate, toDate);

  const airportTripMatch = {
    ...tripDateFilter,
    $or: [
      { airportPickupCode: { $in: ['ORD', 'MDW'] } },
      { airportDropoffCode: { $in: ['ORD', 'MDW'] } },
      { queueType: { $in: ['airport', 'event'] } },
      { assignedFromAirportQueue: true },
    ],
  };

  const [tripBreakdown, queueBreakdown, operationsQueueLogCount, operationsQueueIncidentCount] = await Promise.all([
    Trip.aggregate([
      { $match: airportTripMatch },
      {
        $group: {
          _id: {
            queueType: '$queueType',
            queueGroup: '$queueGroup',
            queueAirportCode: '$queueAirportCode',
            queueEventCode: '$queueEventCode',
            airportPickupCode: '$airportPickupCode',
            airportDropoffCode: '$airportDropoffCode',
            status: '$status',
          },
          tripCount: { $sum: 1 },
          totalAirportFees: { $sum: { $ifNull: ['$airportFee', 0] } },
          assignedFromQueueCount: {
            $sum: {
              $cond: [{ $eq: ['$assignedFromAirportQueue', true] }, 1, 0],
            },
          },
        },
      },
      { $sort: { tripCount: -1 } },
    ]),
    AirportQueueEntry.aggregate([
      { $match: queueDateFilter },
      {
        $group: {
          _id: {
            queueType: '$queueType',
            queueGroup: '$queueGroup',
            airportCode: '$airportCode',
            eventCode: '$eventCode',
            status: '$status',
          },
          entryCount: { $sum: 1 },
        },
      },
      { $sort: { entryCount: -1 } },
    ]),
    DriverLog.countDocuments({
      ...logDateFilter,
      eventType: { $regex: '^operations_queue_' },
    }),
    SafetyLog.countDocuments({
      ...logDateFilter,
      incidentType: {
        $in: ['operations_queue_anomaly', 'airport_rule_violation', 'event_queue_violation'],
      },
    }),
  ]);

  const totals = tripBreakdown.reduce(
    (accumulator, item) => {
      accumulator.totalTrips += Number(item.tripCount || 0);
      accumulator.totalAirportFees += Number(item.totalAirportFees || 0);
      accumulator.assignedFromQueueTrips += Number(item.assignedFromQueueCount || 0);
      return accumulator;
    },
    {
      totalTrips: 0,
      totalAirportFees: 0,
      assignedFromQueueTrips: 0,
    }
  );

  const totalQueueEntries = queueBreakdown.reduce((sum, item) => sum + Number(item.entryCount || 0), 0);

  return {
    generatedAt: new Date(),
    window: {
      from: fromDate,
      to: toDate,
    },
    totals: {
      totalTrips: totals.totalTrips,
      assignedFromQueueTrips: totals.assignedFromQueueTrips,
      totalAirportFees: Number(totals.totalAirportFees.toFixed(2)),
      queueEntries: totalQueueEntries,
      operationsQueueLogs: operationsQueueLogCount,
      operationsQueueIncidents: operationsQueueIncidentCount,
    },
    tripBreakdown: tripBreakdown.map(item => ({
      queueType: item._id.queueType || null,
      queueGroup: item._id.queueGroup || null,
      queueAirportCode: item._id.queueAirportCode || null,
      queueEventCode: item._id.queueEventCode || null,
      airportPickupCode: item._id.airportPickupCode || null,
      airportDropoffCode: item._id.airportDropoffCode || null,
      status: item._id.status || null,
      tripCount: Number(item.tripCount || 0),
      totalAirportFees: Number(Number(item.totalAirportFees || 0).toFixed(2)),
      assignedFromQueueCount: Number(item.assignedFromQueueCount || 0),
    })),
    queueBreakdown: queueBreakdown.map(item => ({
      queueType: item._id.queueType || null,
      queueGroup: item._id.queueGroup || null,
      airportCode: item._id.airportCode || null,
      eventCode: item._id.eventCode || null,
      status: item._id.status || null,
      entryCount: Number(item.entryCount || 0),
    })),
  };
}

module.exports = {
  BACKGROUND_CHECK_DOC_TYPES,
  INSURANCE_DOC_TYPES,
  COMMERCIAL_INSURANCE_DOC_TYPES,
  STATE_DRIVER_LICENSE_DOC_TYPES,
  VEHICLE_REGISTRATION_DOC_TYPES,
  PROFILE_PICTURE_DOC_TYPES,
  HARD_CARD_DOC_TYPES,
  CHAUFFEUR_CREDENTIAL_DOC_TYPES,
  VEHICLE_INSPECTION_DOC_TYPES,
  normalizeDocType,
  resolveReportWindow,
  evaluateDriverChicagoRequirements,
  buildChicagoTnpComplianceReport,
  buildSafetyReport,
  buildAirportOperationsReport,
};
