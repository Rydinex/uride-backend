const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const { uploadDriverDocument } = require('../services/s3Service');
const { getSurgeVisibilityForLocation } = require('../services/pricingService');
const {
  DEFAULT_OPERATING_STATE,
  normalizeStateCode,
  dedupeStateCodes,
  resolveStateRules,
  getStateRule,
} = require('../services/driverComplianceRules');
const { createDriverLog, createSafetyLog } = require('../services/complianceLogService');

const upload = multer({ storage: multer.memoryStorage() });

const DEFAULT_PAYOUT_WEEKS = Number(process.env.DRIVER_PAYOUT_DEFAULT_WEEKS || 8);
const MAX_PAYOUT_WEEKS = Number(process.env.DRIVER_PAYOUT_MAX_WEEKS || 26);
const PAYOUT_DELAY_DAYS = Number(process.env.DRIVER_PAYOUT_DELAY_DAYS || 2);
const DRIVER_PRO_LOOKBACK_DAYS = Number(process.env.DRIVER_PRO_LOOKBACK_DAYS || 90);

const RYDINEX_PRO_TIERS = [
  {
    tier: 'blue',
    label: 'Blue',
    minTrips: 0,
    minRating: 0,
    perks: ['Priority support access', 'Weekly reward challenges', 'Airport queue insights'],
    rewards: ['Starter fuel cashback', 'Document processing priority'],
  },
  {
    tier: 'gold',
    label: 'Gold',
    minTrips: 120,
    minRating: 4.75,
    perks: ['Priority dispatch during busy demand', 'Reduced airport queue friction', 'VIP event queue alerts'],
    rewards: ['Extra destination key every weekend', 'Monthly maintenance bonus'],
  },
  {
    tier: 'platinum',
    label: 'Platinum',
    minTrips: 320,
    minRating: 4.9,
    perks: ['Top dispatch priority and premium ride matching', 'Dedicated support line', 'Early access to earning opportunities'],
    rewards: ['Highest challenge multipliers', 'Quarterly reward bonus'],
  },
];

function signToken(driverId) {
  return jwt.sign({ sub: driverId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function toMoney(value) {
  return Number((Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function toFiniteNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDateInput(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function startOfUtcWeek(input) {
  const date = new Date(input);
  const day = date.getUTCDay();
  const daysToMonday = day === 0 ? -6 : 1 - day;

  date.setUTCDate(date.getUTCDate() + daysToMonday);
  date.setUTCHours(0, 0, 0, 0);

  return date;
}

function endOfUtcWeek(input) {
  const start = startOfUtcWeek(input);
  const end = new Date(start);

  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return end;
}

function addUtcDays(input, days) {
  const output = new Date(input);
  output.setUTCDate(output.getUTCDate() + Number(days || 0));
  return output;
}

function toIsoDateOnly(input) {
  return new Date(input).toISOString().slice(0, 10);
}

function toWeekKey(input) {
  return toIsoDateOnly(startOfUtcWeek(input));
}

function resolvePayoutStatus(weekEndAt, payoutScheduledAt, now = new Date()) {
  if (now >= payoutScheduledAt) {
    return 'paid';
  }

  if (now > weekEndAt) {
    return 'processing';
  }

  return 'scheduled';
}

function toAverageRating(value, count) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(count)) || Number(count) <= 0) {
    return null;
  }

  return Number((Number(value) / Number(count)).toFixed(2));
}

function resolveRydineXProTier(completedTrips, averageRating) {
  const normalizedTrips = Math.max(Number(completedTrips) || 0, 0);
  const normalizedRating = Number.isFinite(Number(averageRating)) ? Number(averageRating) : null;

  let currentTier = RYDINEX_PRO_TIERS[0];

  RYDINEX_PRO_TIERS.forEach(tierRule => {
    const meetsTrips = normalizedTrips >= tierRule.minTrips;
    const meetsRating = normalizedRating === null ? tierRule.minRating === 0 : normalizedRating >= tierRule.minRating;

    if (meetsTrips && meetsRating) {
      currentTier = tierRule;
    }
  });

  const currentTierIndex = RYDINEX_PRO_TIERS.findIndex(rule => rule.tier === currentTier.tier);
  const nextTier = currentTierIndex >= 0 ? RYDINEX_PRO_TIERS[currentTierIndex + 1] || null : null;

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      tripProgressPercent: 100,
      tripsToNextTier: 0,
      ratingNeededForNextTier: 0,
    };
  }

  const tierTripSpan = Math.max(nextTier.minTrips - currentTier.minTrips, 1);
  const completedTripSpan = Math.max(normalizedTrips - currentTier.minTrips, 0);
  const tripProgressPercent = Math.max(Math.min((completedTripSpan / tierTripSpan) * 100, 100), 0);
  const tripsToNextTier = Math.max(nextTier.minTrips - normalizedTrips, 0);
  const ratingNeededForNextTier =
    normalizedRating === null ? nextTier.minRating : Math.max(Number((nextTier.minRating - normalizedRating).toFixed(2)), 0);

  return {
    currentTier,
    nextTier,
    tripProgressPercent: Number(tripProgressPercent.toFixed(1)),
    tripsToNextTier,
    ratingNeededForNextTier,
  };
}

function buildMultiStateRulesResponse(stateCodesInput) {
  const stateCodes = dedupeStateCodes(stateCodesInput);
  const resolved = resolveStateRules(stateCodes.length ? stateCodes : [DEFAULT_OPERATING_STATE]);
  const requiresChauffeurLicense = resolved.rules.some(rule => Boolean(rule.chauffeurLicenseRequired));

  return {
    operatingStates: resolved.operatingStates,
    unsupportedStates: resolved.unsupportedStates,
    requiresChauffeurLicense,
    rules: resolved.rules.map(rule => ({
      code: rule.code,
      name: rule.name,
      chauffeurLicenseRequired: Boolean(rule.chauffeurLicenseRequired),
      vehicleInspectionIntervalDays: Number(rule.vehicleInspectionIntervalDays || 0),
      backgroundCheckRenewalDays: Number(rule.backgroundCheckRenewalDays || 0),
      requiredDocuments: Array.isArray(rule.requiredDocuments) ? rule.requiredDocuments : [],
      notes: Array.isArray(rule.notes) ? rule.notes : [],
    })),
  };
}

async function registerDriver(req, res) {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ message: 'name, phone, email and password are required.' });
    }

    const existingDriver = await Driver.findOne({
      $or: [{ phone }, { email: email.toLowerCase() }],
    });

    if (existingDriver) {
      return res.status(409).json({ message: 'Driver with phone or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const driver = await Driver.create({
      name,
      phone,
      email,
      passwordHash,
      status: 'pending',
    });

    await createDriverLog({
      driver: driver._id,
      eventType: 'driver_registered',
      actorType: 'driver',
      actorId: String(driver._id),
      severity: 'info',
      metadata: {
        status: driver.status,
      },
    }).catch(() => null);

    const token = signToken(driver._id.toString());

    return res.status(201).json({
      message: 'Driver registered successfully.',
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        status: driver.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to register driver.' });
  }
}

async function uploadDocument(req, res) {
  try {
    const { driverId } = req.params;
    const { docType, expiresAt = null } = req.body;

    if (!docType) {
      return res.status(400).json({ message: 'docType is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'document file is required.' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const uploadedUrl = await uploadDriverDocument(req.file, driverId, docType);
    let normalizedExpiresAt = null;
    if (expiresAt) {
      const parsedExpiration = new Date(expiresAt);
      if (!Number.isNaN(parsedExpiration.getTime())) {
        normalizedExpiresAt = parsedExpiration;
      }
    }

    driver.docs.push({
      docType,
      url: uploadedUrl,
      status: 'pending',
      expiresAt: normalizedExpiresAt,
    });
    await driver.save();

    await createDriverLog({
      driver: driver._id,
      eventType: 'driver_document_uploaded',
      actorType: 'driver',
      actorId: String(driver._id),
      severity: 'info',
      metadata: {
        docType,
        expiresAt: normalizedExpiresAt,
      },
    }).catch(() => null);

    if (normalizedExpiresAt && normalizedExpiresAt.getTime() < Date.now()) {
      await createSafetyLog({
        incidentType: 'document_expired',
        severity: 'high',
        status: 'open',
        driver: driver._id,
        reportedByType: 'system',
        title: `Expired ${docType} uploaded`,
        description: `Driver uploaded an already expired ${docType} document.`,
        metadata: {
          docType,
          expiresAt: normalizedExpiresAt,
        },
      }).catch(() => null);
    }

    return res.status(201).json({ message: 'Document uploaded successfully.', url: uploadedUrl });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to upload document.' });
  }
}

async function upsertVehicle(req, res) {
  try {
    const { driverId } = req.params;
    const { make, model, year, plateNumber, color, powertrain = 'gasoline', photoUrl = null } = req.body;

    if (!make || !model || !year || !plateNumber) {
      return res.status(400).json({ message: 'make, model, year and plateNumber are required.' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { driver: driverId },
      { make, model, year, plateNumber, color, powertrain, photoUrl },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    driver.vehicle = vehicle._id;
    await driver.save();

    await createDriverLog({
      driver: driver._id,
      eventType: 'vehicle_updated',
      actorType: 'driver',
      actorId: String(driver._id),
      severity: 'info',
      metadata: {
        vehicleId: vehicle._id,
        make,
        model,
        year,
        plateNumber,
        powertrain,
        hasPhotoUrl: Boolean(photoUrl),
      },
    }).catch(() => null);

    return res.status(200).json({ message: 'Vehicle info saved.', vehicle });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save vehicle info.' });
  }
}

async function uploadVehicleInspection(req, res) {
  try {
    const { driverId } = req.params;
    const { expiresAt = null, inspectionCenter = '', notes = '' } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'inspection file is required.' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const expiresAtDate = expiresAt ? parseDateInput(expiresAt) : null;
    if (expiresAt && !expiresAtDate) {
      return res.status(400).json({ message: 'expiresAt must be a valid date string.' });
    }

    const inspectionUrl = await uploadDriverDocument(req.file, driverId, 'vehicle_inspection');

    driver.docs.push({
      docType: 'vehicle_inspection',
      url: inspectionUrl,
      status: 'pending',
      expiresAt: expiresAtDate,
    });

    driver.vehicleInspection = {
      reportUrl: inspectionUrl,
      status: 'pending',
      uploadedAt: new Date(),
      expiresAt: expiresAtDate,
      inspectionCenter: String(inspectionCenter || '').trim(),
      notes: String(notes || '').trim(),
    };

    await driver.save();

    await createDriverLog({
      driver: driver._id,
      eventType: 'vehicle_inspection_uploaded',
      actorType: 'driver',
      actorId: String(driver._id),
      severity: 'info',
      metadata: {
        expiresAt: expiresAtDate,
        inspectionCenter: String(inspectionCenter || '').trim(),
      },
    }).catch(() => null);

    return res.status(201).json({
      message: 'Vehicle inspection uploaded successfully.',
      vehicleInspection: driver.vehicleInspection,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to upload vehicle inspection.' });
  }
}

async function verifyChauffeurLicense(req, res) {
  try {
    const { driverId } = req.params;
    const { licenseNumber, issuingState, expiresAt = null } = req.body;

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const normalizedLicenseNumber = String(licenseNumber || '').trim().toUpperCase();
    const normalizedIssuingState = normalizeStateCode(issuingState);
    const stateRule = getStateRule(normalizedIssuingState);

    if (!stateRule) {
      return res.status(400).json({
        message: `Unsupported issuingState '${normalizedIssuingState}'. Configure multi-state rules first.`,
      });
    }

    const expiresAtDate = expiresAt ? parseDateInput(expiresAt) : null;
    if (expiresAt && !expiresAtDate) {
      return res.status(400).json({ message: 'expiresAt must be a valid date string.' });
    }

    let verificationStatus = 'verified';
    let verificationNotes = 'License format and expiration checks passed.';

    if (!/^[A-Z0-9-]{6,30}$/.test(normalizedLicenseNumber)) {
      verificationStatus = 'rejected';
      verificationNotes = 'License format is invalid.';
    }

    if (expiresAtDate && expiresAtDate.getTime() < Date.now()) {
      verificationStatus = 'rejected';
      verificationNotes = 'License is expired.';
    }

    if (verificationStatus !== 'rejected' && stateRule.chauffeurLicenseRequired && !expiresAtDate) {
      verificationStatus = 'pending';
      verificationNotes = 'Expiration date is required for this state before final verification.';
    }

    if (verificationStatus !== 'rejected' && !stateRule.chauffeurLicenseRequired) {
      verificationNotes = 'State does not require chauffeur license; verification stored for record.';
    }

    driver.chauffeurLicense = {
      licenseNumber: normalizedLicenseNumber,
      issuingState: normalizedIssuingState,
      status: verificationStatus,
      verifiedAt: verificationStatus === 'verified' ? new Date() : null,
      expiresAt: expiresAtDate,
      verificationNotes,
    };

    await driver.save();

    await createDriverLog({
      driver: driver._id,
      eventType: 'chauffeur_license_verification',
      actorType: 'system',
      actorId: String(driver._id),
      severity: verificationStatus === 'rejected' ? 'warning' : 'info',
      metadata: {
        issuingState: normalizedIssuingState,
        status: verificationStatus,
        expiresAt: expiresAtDate,
      },
    }).catch(() => null);

    return res.status(200).json({
      message: 'Chauffeur license verification updated.',
      requiresChauffeurLicense: Boolean(stateRule.chauffeurLicenseRequired),
      chauffeurLicense: driver.chauffeurLicense,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to verify chauffeur license.' });
  }
}

async function upsertMultiStateRules(req, res) {
  try {
    const { driverId } = req.params;
    const { operatingStates = [] } = req.body;

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const profile = buildMultiStateRulesResponse(operatingStates);
    if (profile.unsupportedStates.length) {
      return res.status(400).json({
        message: `Unsupported state codes: ${profile.unsupportedStates.join(', ')}`,
      });
    }

    driver.operatingStates = profile.operatingStates;
    await driver.save();

    await createDriverLog({
      driver: driver._id,
      eventType: 'driver_multi_state_rules_updated',
      actorType: 'driver',
      actorId: String(driver._id),
      severity: 'info',
      metadata: {
        operatingStates: profile.operatingStates,
      },
    }).catch(() => null);

    return res.status(200).json({
      message: 'Multi-state rules updated successfully.',
      profile: {
        ...profile,
        chauffeurLicenseStatus: driver.chauffeurLicense?.status || 'unverified',
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update multi-state rules.' });
  }
}

async function getMultiStateRules(req, res) {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findById(driverId).select('operatingStates chauffeurLicense');
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const profile = buildMultiStateRulesResponse(driver.operatingStates || [DEFAULT_OPERATING_STATE]);

    return res.status(200).json({
      ...profile,
      chauffeurLicenseStatus: driver.chauffeurLicense?.status || 'unverified',
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch multi-state rules.' });
  }
}

async function getSurgeVisibility(req, res) {
  try {
    const { driverId } = req.params;
    const latitude = toFiniteNumber(req.query?.latitude);
    const longitude = toFiniteNumber(req.query?.longitude);
    const surgeRadiusKm = toFiniteNumber(req.query?.surgeRadiusKm, undefined);
    const rideCategory = req.query?.rideCategory;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'latitude and longitude are required query parameters.' });
    }

    const driver = await Driver.findById(driverId).select('operatingStates');
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const surge = await getSurgeVisibilityForLocation({
      latitude,
      longitude,
      surgeRadiusKm,
      rideCategory,
    });

    return res.status(200).json({
      driverId,
      operatingStates: Array.isArray(driver.operatingStates) && driver.operatingStates.length
        ? driver.operatingStates
        : [DEFAULT_OPERATING_STATE],
      ...surge,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch surge visibility.' });
  }
}

async function getWeeklyPayouts(req, res) {
  try {
    const { driverId } = req.params;
    const requestedWeeks = Number(req.query?.weeks || DEFAULT_PAYOUT_WEEKS);
    const weeks = Math.min(Math.max(Number.isFinite(requestedWeeks) ? requestedWeeks : DEFAULT_PAYOUT_WEEKS, 1), MAX_PAYOUT_WEEKS);

    const driver = await Driver.findById(driverId).select('name status');
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const currentWeekStart = startOfUtcWeek(new Date());
    const oldestWeekStart = addUtcDays(currentWeekStart, -(weeks - 1) * 7);

    const trips = await Trip.find({
      driver: driverId,
      status: 'completed',
      completedAt: {
        $ne: null,
        $gte: oldestWeekStart,
      },
    })
      .select('completedAt fareEstimate upfrontFare platformCommission platformCommissionRate driverEarnings currency')
      .sort({ completedAt: -1 })
      .lean();

    const weeklyMap = new Map();

    for (let index = 0; index < weeks; index += 1) {
      const weekStart = addUtcDays(currentWeekStart, -index * 7);
      const weekEnd = endOfUtcWeek(weekStart);
      const payoutScheduledAt = addUtcDays(weekEnd, PAYOUT_DELAY_DAYS);
      const weekKey = toIsoDateOnly(weekStart);

      weeklyMap.set(weekKey, {
        weekStart: weekKey,
        weekEnd: toIsoDateOnly(weekEnd),
        payoutScheduledAt: payoutScheduledAt.toISOString(),
        payoutStatus: resolvePayoutStatus(weekEnd, payoutScheduledAt),
        tripCount: 0,
        grossFare: 0,
        platformCommission: 0,
        driverEarnings: 0,
        averageSurgeMultiplier: 1,
      });
    }

    trips.forEach(trip => {
      const completedAt = trip.completedAt ? new Date(trip.completedAt) : null;
      if (!completedAt || Number.isNaN(completedAt.getTime())) {
        return;
      }

      const weekKey = toWeekKey(completedAt);
      const bucket = weeklyMap.get(weekKey);
      if (!bucket) {
        return;
      }

      const grossFare = toMoney(trip.fareEstimate ?? trip.upfrontFare ?? 0);
      const platformCommission = toMoney(trip.platformCommission || 0);
      const driverEarnings =
        trip.driverEarnings !== null && trip.driverEarnings !== undefined
          ? toMoney(trip.driverEarnings)
          : toMoney(grossFare - platformCommission);

      bucket.tripCount += 1;
      bucket.grossFare = toMoney(bucket.grossFare + grossFare);
      bucket.platformCommission = toMoney(bucket.platformCommission + platformCommission);
      bucket.driverEarnings = toMoney(bucket.driverEarnings + driverEarnings);
    });

    const weekly = Array.from(weeklyMap.values()).sort((left, right) => right.weekStart.localeCompare(left.weekStart));

    const totals = weekly.reduce(
      (accumulator, item) => ({
        grossFare: toMoney(accumulator.grossFare + item.grossFare),
        platformCommission: toMoney(accumulator.platformCommission + item.platformCommission),
        driverEarnings: toMoney(accumulator.driverEarnings + item.driverEarnings),
        tripCount: accumulator.tripCount + item.tripCount,
      }),
      {
        grossFare: 0,
        platformCommission: 0,
        driverEarnings: 0,
        tripCount: 0,
      }
    );

    const nextPayout = weekly
      .filter(item => item.payoutStatus !== 'paid')
      .sort((left, right) => left.payoutScheduledAt.localeCompare(right.payoutScheduledAt))[0] || null;

    return res.status(200).json({
      currency: 'USD',
      weeksRequested: weeks,
      payoutDelayDays: PAYOUT_DELAY_DAYS,
      weekly,
      totals,
      nextPayout,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch weekly payouts.' });
  }
}

async function getTripEarningsHistory(req, res) {
  try {
    const { driverId } = req.params;
    const requestedLimit = Number(req.query?.limit || 25);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 25, 1), 100);

    const driver = await Driver.findById(driverId).select('name status');
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const trips = await Trip.find({
      driver: driverId,
      status: 'completed',
    })
      .select(
        'completedAt pickup dropoff fareEstimate upfrontFare platformCommission platformCommissionRate driverEarnings surgeMultiplier currency actualDistanceMiles actualDurationMinutes'
      )
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const earnings = trips.map(trip => {
      const grossFare = toMoney(trip.fareEstimate ?? trip.upfrontFare ?? 0);
      const platformCommission = toMoney(trip.platformCommission || 0);
      const driverEarnings =
        trip.driverEarnings !== null && trip.driverEarnings !== undefined
          ? toMoney(trip.driverEarnings)
          : toMoney(grossFare - platformCommission);

      return {
        tripId: String(trip._id),
        completedAt: trip.completedAt,
        pickup: trip.pickup,
        dropoff: trip.dropoff,
        surgeMultiplier: Number(Number(trip.surgeMultiplier || 1).toFixed(2)),
        grossFare,
        platformCommission,
        platformCommissionRate: Number(Number(trip.platformCommissionRate || 0).toFixed(4)),
        driverEarnings,
        currency: trip.currency || 'USD',
        actualDistanceMiles: Number(Number(trip.actualDistanceMiles || 0).toFixed(3)),
        actualDurationMinutes: Number(Number(trip.actualDurationMinutes || 0).toFixed(2)),
      };
    });

    const totals = earnings.reduce(
      (accumulator, trip) => ({
        grossFare: toMoney(accumulator.grossFare + trip.grossFare),
        platformCommission: toMoney(accumulator.platformCommission + trip.platformCommission),
        driverEarnings: toMoney(accumulator.driverEarnings + trip.driverEarnings),
      }),
      {
        grossFare: 0,
        platformCommission: 0,
        driverEarnings: 0,
      }
    );

    return res.status(200).json({
      currency: 'USD',
      count: earnings.length,
      earnings,
      totals,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch trip earnings history.' });
  }
}

async function updateDriverTripPreferences(req, res) {
  try {
    const { driverId } = req.params;
    const { serviceDogEnabled, teenPickupEnabled } = req.body;

    const driver = await Driver.findById(driverId).select('tripPreferences');
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    driver.tripPreferences = {
      serviceDogEnabled: Boolean(serviceDogEnabled),
      teenPickupEnabled: Boolean(teenPickupEnabled),
    };

    await driver.save();

    await createDriverLog({
      driver: driver._id,
      eventType: 'driver_trip_preferences_updated',
      actorType: 'driver',
      actorId: String(driver._id),
      severity: 'info',
      metadata: {
        tripPreferences: driver.tripPreferences,
      },
    }).catch(() => null);

    return res.status(200).json({
      message: 'Trip preferences updated.',
      tripPreferences: driver.tripPreferences,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update trip preferences.' });
  }
}

async function getDriverProStatus(req, res) {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findById(driverId).select('name status');
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const lookbackStart = addUtcDays(new Date(), -Math.max(DRIVER_PRO_LOOKBACK_DAYS, 1));
    const completedTrips = await Trip.find({
      driver: driverId,
      status: 'completed',
      completedAt: {
        $ne: null,
        $gte: lookbackStart,
      },
    })
      .select('driverEarnings fareEstimate upfrontFare platformCommission riderOverallRating completedAt')
      .sort({ completedAt: -1 })
      .lean();

    const tripCount = completedTrips.length;
    const earningsTotal = completedTrips.reduce((sum, trip) => {
      const grossFare = toMoney(trip.fareEstimate ?? trip.upfrontFare ?? 0);
      const platformCommission = toMoney(trip.platformCommission || 0);
      const fallbackDriverEarnings = toMoney(grossFare - platformCommission);
      const driverEarnings =
        trip.driverEarnings !== null && trip.driverEarnings !== undefined
          ? toMoney(trip.driverEarnings)
          : fallbackDriverEarnings;

      return toMoney(sum + driverEarnings);
    }, 0);

    const ratings = completedTrips
      .map(trip => Number(trip.riderOverallRating))
      .filter(rating => Number.isInteger(rating) && rating >= 1 && rating <= 5);

    const averageRiderRating = toAverageRating(
      ratings.reduce((sum, rating) => sum + rating, 0),
      ratings.length
    );

    const tierSummary = resolveRydineXProTier(tripCount, averageRiderRating);

    return res.status(200).json({
      driverId,
      lookbackDays: Math.max(DRIVER_PRO_LOOKBACK_DAYS, 1),
      completedTrips: tripCount,
      averageRiderRating,
      ratingsReceived: ratings.length,
      driverEarnings: earningsTotal,
      currency: 'USD',
      currentTier: {
        code: tierSummary.currentTier.tier,
        label: tierSummary.currentTier.label,
      },
      nextTier: tierSummary.nextTier
        ? {
            code: tierSummary.nextTier.tier,
            label: tierSummary.nextTier.label,
            minTrips: tierSummary.nextTier.minTrips,
            minRating: tierSummary.nextTier.minRating,
          }
        : null,
      tripProgressPercent: tierSummary.tripProgressPercent,
      tripsToNextTier: tierSummary.tripsToNextTier,
      ratingNeededForNextTier: tierSummary.ratingNeededForNextTier,
      perks: tierSummary.currentTier.perks,
      rewards: tierSummary.currentTier.rewards,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch driver pro status.' });
  }
}

async function getDriverStatus(req, res) {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findById(driverId)
      .select('name phone email status rejectionReason docs vehicle operatingStates chauffeurLicense vehicleInspection tripPreferences')
      .populate('vehicle');
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    return res.status(200).json(driver);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch driver status.' });
  }
}

async function loginDriver(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'email and password are required.' });
      }

      const driver = await Driver.findOne({ email: email.toLowerCase() }).select(
        'passwordHash name phone email status approvalStatus'
      );

      if (!driver) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const valid = await bcrypt.compare(password, driver.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const token = signToken(driver._id.toString());

      return res.status(200).json({
        message: 'Login successful.',
        token,
        driver: {
          id: driver._id,
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          status: driver.status,
          approvalStatus: driver.approvalStatus,
        },
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || 'Login failed.' });
    }
}

module.exports = {
  uploadMiddleware: upload.single('document'),
  registerDriver,
  loginDriver,
  uploadDocument,
  upsertVehicle,
  uploadVehicleInspection,
  verifyChauffeurLicense,
  upsertMultiStateRules,
  getMultiStateRules,
  getSurgeVisibility,
  getWeeklyPayouts,
  getTripEarningsHistory,
  updateDriverTripPreferences,
  getDriverProStatus,
  getDriverStatus,
};
