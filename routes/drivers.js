const express = require('express');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  validateIdParam,
  validateDriverRegistration,
  validateDriverDocumentUpload,
  validateDriverStatesPayload,
  validateDriverChauffeurLicenseVerification,
  validateDriverSurgeQuery,
  validateDriverTripPreferences,
  validateVehiclePayload,
} = require('../middleware/requestValidation');
const {
  uploadMiddleware,
  registerDriver,
    loginDriver,
  uploadDocument,
  uploadVehicleInspection,
  verifyChauffeurLicense,
  upsertMultiStateRules,
  getMultiStateRules,
  getSurgeVisibility,
  getWeeklyPayouts,
  getTripEarningsHistory,
  getDriverProStatus,
  getDriverStatus,
  updateDriverTripPreferences,
} = require('../controllers/driverController');
const { upsertVehicle } = require('../controllers/vehicleController');

const router = express.Router();

const registerRateLimiter = createRateLimiter({
  identifier: 'drivers:register',
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_DRIVER_REGISTER_MAX || 10),
  message: 'Too many registration attempts. Please wait before trying again.',
});

const documentUploadRateLimiter = createRateLimiter({
  identifier: 'drivers:document-upload',
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_DRIVER_DOCUMENT_UPLOAD_MAX || 20),
  message: 'Too many document uploads. Please slow down.',
});

router.post('/register', registerRateLimiter, validateDriverRegistration, registerDriver);
router.post('/login', loginDriver);
router.post(
  '/:driverId/documents',
  validateIdParam('driverId'),
  documentUploadRateLimiter,
  uploadMiddleware,
  validateDriverDocumentUpload,
  uploadDocument
);
router.post('/:driverId/vehicle', validateIdParam('driverId'), validateVehiclePayload, upsertVehicle);
router.post(
  '/:driverId/vehicle-inspection',
  validateIdParam('driverId'),
  documentUploadRateLimiter,
  uploadMiddleware,
  uploadVehicleInspection
);
router.post(
  '/:driverId/chauffeur-license/verify',
  validateIdParam('driverId'),
  validateDriverChauffeurLicenseVerification,
  verifyChauffeurLicense
);
router.post('/:driverId/multi-state-rules', validateIdParam('driverId'), validateDriverStatesPayload, upsertMultiStateRules);
router.get('/:driverId/multi-state-rules', validateIdParam('driverId'), getMultiStateRules);
router.get('/:driverId/surge-visibility', validateIdParam('driverId'), validateDriverSurgeQuery, getSurgeVisibility);
router.get('/:driverId/payouts/weekly', validateIdParam('driverId'), getWeeklyPayouts);
router.get('/:driverId/earnings/trips', validateIdParam('driverId'), getTripEarningsHistory);
router.get('/:driverId/pro-status', validateIdParam('driverId'), getDriverProStatus);
router.post(
  '/:driverId/trip-preferences',
  validateIdParam('driverId'),
  validateDriverTripPreferences,
  updateDriverTripPreferences
);
router.get('/:driverId/status', validateIdParam('driverId'), getDriverStatus);

module.exports = router;
