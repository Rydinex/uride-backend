const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d()\-\s]{7,20}$/;
const PLATE_REGEX = /^[A-Za-z0-9\-\s]{3,20}$/;

function toTrimmedString(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\0/g, '').trim();
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addError(errors, field, message) {
  errors.push({ field, message });
}

function sendValidationError(res, errors) {
  return res.status(400).json({
    message: 'Validation failed.',
    errors,
  });
}

function parseRequiredString(errors, value, field, { min = 1, max = 255 } = {}) {
  const normalized = toTrimmedString(value);
  if (!normalized) {
    addError(errors, field, 'is required.');
    return '';
  }

  if (normalized.length < min) {
    addError(errors, field, `must be at least ${min} characters.`);
  }

  if (normalized.length > max) {
    addError(errors, field, `must be at most ${max} characters.`);
  }

  return normalized;
}

function parseOptionalString(errors, value, field, { max = 255 } = {}) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = toTrimmedString(value);
  if (normalized.length > max) {
    addError(errors, field, `must be at most ${max} characters.`);
  }

  return normalized;
}

function parseObjectId(errors, value, field) {
  const normalized = toTrimmedString(value);
  if (!normalized || !OBJECT_ID_REGEX.test(normalized)) {
    addError(errors, field, 'must be a valid ObjectId.');
    return '';
  }

  return normalized;
}

function parseEmail(errors, value, field) {
  const normalized = parseRequiredString(errors, value, field, { min: 5, max: 254 }).toLowerCase();
  if (normalized && !EMAIL_REGEX.test(normalized)) {
    addError(errors, field, 'must be a valid email address.');
  }
  return normalized;
}

function parsePhone(errors, value, field) {
  const normalized = parseRequiredString(errors, value, field, { min: 7, max: 20 });
  if (normalized && !PHONE_REGEX.test(normalized)) {
    addError(errors, field, 'must contain only valid phone characters.');
  }
  return normalized;
}

function parseStateCode(errors, value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      addError(errors, field, 'is required.');
    }
    return required ? '' : null;
  }

  const normalized = toTrimmedString(value).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    addError(errors, field, 'must be a 2-letter state code.');
  }

  return normalized;
}

function parseCountryCode(errors, value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      addError(errors, field, 'is required.');
    }
    return required ? '' : null;
  }

  const normalized = toTrimmedString(value).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    addError(errors, field, 'must be a 2-letter country code.');
  }

  return normalized;
}

function parsePassword(errors, value, field) {
  const normalized = parseRequiredString(errors, value, field, { min: 8, max: 128 });

  if (normalized && !/[A-Za-z]/.test(normalized)) {
    addError(errors, field, 'must contain at least one letter.');
  }

  if (normalized && !/\d/.test(normalized)) {
    addError(errors, field, 'must contain at least one number.');
  }

  return normalized;
}

function parseLatitude(errors, value, field) {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < -90 || parsed > 90) {
    addError(errors, field, 'must be a number between -90 and 90.');
    return null;
  }

  return parsed;
}

function parseLongitude(errors, value, field) {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < -180 || parsed > 180) {
    addError(errors, field, 'must be a number between -180 and 180.');
    return null;
  }

  return parsed;
}

function parseRideCategory(errors, value, field, { required = false, fallback = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      addError(errors, field, 'is required.');
      return '';
    }

    return fallback;
  }

  let normalized = toTrimmedString(value).toLowerCase();
  if (normalized === 'suv') {
    normalized = 'black_suv';
  }

  const allowedCategories = ['black_car', 'black_suv'];

  if (!allowedCategories.includes(normalized)) {
    addError(errors, field, `must be one of: ${allowedCategories.join(', ')}.`);
    return '';
  }

  return normalized;
}

function parseBookingType(errors, value, field, { required = false, fallback = 'on_demand' } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      addError(errors, field, 'is required.');
      return '';
    }

    return fallback;
  }

  const normalized = toTrimmedString(value).toLowerCase();
  const allowedBookingTypes = ['on_demand', 'reservation', 'hourly'];

  if (!allowedBookingTypes.includes(normalized)) {
    addError(errors, field, `must be one of: ${allowedBookingTypes.join(', ')}.`);
    return '';
  }

  return normalized;
}

function parseScheduledAt(errors, value, field, { required = false, minLeadMinutes = 15 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      addError(errors, field, 'is required.');
    }
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    addError(errors, field, 'must be a valid datetime string.');
    return null;
  }

  const minimumAllowed = Date.now() + Math.max(Number(minLeadMinutes) || 0, 0) * 60 * 1000;
  if (parsed.getTime() < minimumAllowed) {
    addError(errors, field, `must be at least ${Math.max(Number(minLeadMinutes) || 0, 0)} minutes in the future.`);
  }

  return parsed;
}

function parseEstimatedHours(errors, value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      addError(errors, field, 'is required.');
    }
    return null;
  }

  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed < 1 || parsed > 24) {
    addError(errors, field, 'must be between 1 and 24.');
    return null;
  }

  return Number(parsed.toFixed(2));
}

function parseOptionalRating(errors, value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = toFiniteNumber(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    addError(errors, field, 'must be an integer between 1 and 5.');
    return null;
  }

  return parsed;
}

function parseTripPoint(errors, value, field) {
  if (!value || typeof value !== 'object') {
    addError(errors, field, 'is required.');
    return null;
  }

  const latitude = parseLatitude(errors, value.latitude, `${field}.latitude`);
  const longitude = parseLongitude(errors, value.longitude, `${field}.longitude`);
  const address = parseOptionalString(errors, value.address, `${field}.address`, { max: 200 }) || '';
  const city = parseOptionalString(errors, value.city, `${field}.city`, { max: 120 }) || '';
  const state = parseStateCode(errors, value.state, `${field}.state`, { required: false });
  const country = parseCountryCode(errors, value.country, `${field}.country`, { required: false });

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    address,
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
  };
}

function parseRoutePoint(errors, value, field) {
  if (!value || typeof value !== 'object') {
    addError(errors, field, 'must be an object.');
    return null;
  }

  const latitude = parseLatitude(errors, value.latitude, `${field}.latitude`);
  const longitude = parseLongitude(errors, value.longitude, `${field}.longitude`);

  const speedKph = value.speedKph === undefined || value.speedKph === null ? null : toFiniteNumber(value.speedKph);
  if (speedKph !== null && (speedKph < 0 || speedKph > 350)) {
    addError(errors, `${field}.speedKph`, 'must be between 0 and 350.');
  }

  const heading = value.heading === undefined || value.heading === null ? null : toFiniteNumber(value.heading);
  if (heading !== null && (heading < 0 || heading > 360)) {
    addError(errors, `${field}.heading`, 'must be between 0 and 360.');
  }

  const accuracyMeters =
    value.accuracyMeters === undefined || value.accuracyMeters === null ? null : toFiniteNumber(value.accuracyMeters);
  if (accuracyMeters !== null && (accuracyMeters < 0 || accuracyMeters > 5000)) {
    addError(errors, `${field}.accuracyMeters`, 'must be between 0 and 5000.');
  }

  let recordedAt = null;
  if (value.recordedAt) {
    const parsedRecordedAt = new Date(value.recordedAt);
    if (Number.isNaN(parsedRecordedAt.getTime())) {
      addError(errors, `${field}.recordedAt`, 'must be a valid date string.');
    } else {
      recordedAt = parsedRecordedAt;
    }
  }

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    speedKph,
    heading,
    accuracyMeters,
    recordedAt,
  };
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = toTrimmedString(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseBooleanField(errors, value, field, { required = false, fallback = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      addError(errors, field, 'is required.');
    }
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = toTrimmedString(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  addError(errors, field, 'must be a boolean value.');
  return fallback;
}

function parseTeenSeatingPolicy(errors, value, field, { teenPickup = false } = {}) {
  const allowedPolicies = new Set(['none', 'back_seat_only']);
  const normalized = value === undefined || value === null || value === '' ? 'none' : toTrimmedString(value).toLowerCase();

  if (!allowedPolicies.has(normalized)) {
    addError(errors, field, "must be either 'none' or 'back_seat_only'.");
  }

  if (teenPickup) {
    return 'back_seat_only';
  }

  return normalized;
}

function validateIdParam(paramName) {
  return function validateIdParamMiddleware(req, res, next) {
    const errors = [];
    const normalized = parseObjectId(errors, req.params[paramName], `params.${paramName}`);

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    req.params[paramName] = normalized;
    return next();
  };
}

function validateDriverRegistration(req, res, next) {
  const errors = [];
  const name = parseRequiredString(errors, req.body?.name, 'name', { min: 2, max: 120 });
  const phone = parsePhone(errors, req.body?.phone, 'phone');
  const email = parseEmail(errors, req.body?.email, 'email');
  const password = parsePassword(errors, req.body?.password, 'password');

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    name,
    phone,
    email,
    password,
  };

  return next();
}

function validateDriverDocumentUpload(req, res, next) {
  const errors = [];
  const allowedDocTypes = new Set([
    'license',
    'state_driver_license',
    'state_issued_driver_license',
    'national_id',
    'insurance',
    'commercial_insurance',
    'vehicle_registration',
    'background_check',
    'vehicle_inspection',
    'chauffeur_license',
    'city_chauffeur_license',
    'taxi_chauffeur_license',
    'hard_card',
    'profile_picture',
  ]);

  const docType = parseRequiredString(errors, req.body?.docType, 'docType', { min: 2, max: 50 }).toLowerCase();
  if (docType && !allowedDocTypes.has(docType)) {
    addError(errors, 'docType', `must be one of: ${Array.from(allowedDocTypes).join(', ')}.`);
  }

  let normalizedExpiresAt = null;
  if (req.body?.expiresAt !== undefined && req.body?.expiresAt !== null && req.body?.expiresAt !== '') {
    const parsedExpiration = new Date(req.body.expiresAt);
    if (Number.isNaN(parsedExpiration.getTime())) {
      addError(errors, 'expiresAt', 'must be a valid date string.');
    } else {
      normalizedExpiresAt = parsedExpiration.toISOString();
    }
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body.docType = docType;
  req.body.expiresAt = normalizedExpiresAt;
  return next();
}

function validateDriverStatesPayload(req, res, next) {
  const errors = [];
  const input = req.body?.operatingStates;

  let rawStates = [];
  if (Array.isArray(input)) {
    rawStates = input;
  } else if (typeof input === 'string') {
    rawStates = input.split(',');
  } else {
    addError(errors, 'operatingStates', 'must be an array or comma-separated string.');
  }

  const normalizedStates = Array.from(
    new Set(rawStates.map(state => parseStateCode(errors, state, 'operatingStates[]', { required: true })).filter(Boolean))
  );

  if (!normalizedStates.length) {
    addError(errors, 'operatingStates', 'must include at least one state code.');
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body.operatingStates = normalizedStates;
  return next();
}

function validateDriverChauffeurLicenseVerification(req, res, next) {
  const errors = [];

  const licenseNumber = parseRequiredString(errors, req.body?.licenseNumber, 'licenseNumber', {
    min: 6,
    max: 30,
  }).toUpperCase();

  if (licenseNumber && !/^[A-Z0-9-]+$/.test(licenseNumber)) {
    addError(errors, 'licenseNumber', 'must contain only letters, numbers, or dashes.');
  }

  const issuingState = parseStateCode(errors, req.body?.issuingState, 'issuingState', { required: true });

  let expiresAt = null;
  if (req.body?.expiresAt !== undefined && req.body?.expiresAt !== null && req.body?.expiresAt !== '') {
    const parsedExpiration = new Date(req.body.expiresAt);
    if (Number.isNaN(parsedExpiration.getTime())) {
      addError(errors, 'expiresAt', 'must be a valid date string.');
    } else {
      expiresAt = parsedExpiration.toISOString();
    }
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    licenseNumber,
    issuingState,
    expiresAt,
  };

  return next();
}

function validateDriverSurgeQuery(req, res, next) {
  const errors = [];

  const latitude = parseLatitude(errors, req.query?.latitude, 'query.latitude');
  const longitude = parseLongitude(errors, req.query?.longitude, 'query.longitude');
  const rideCategory = parseRideCategory(errors, req.query?.rideCategory, 'query.rideCategory', {
    required: false,
    fallback: undefined,
  });

  let surgeRadiusKm = req.query?.surgeRadiusKm;
  if (surgeRadiusKm !== undefined && surgeRadiusKm !== null && surgeRadiusKm !== '') {
    surgeRadiusKm = toFiniteNumber(surgeRadiusKm);
    if (surgeRadiusKm === null || surgeRadiusKm < 0.5 || surgeRadiusKm > 50) {
      addError(errors, 'query.surgeRadiusKm', 'must be between 0.5 and 50.');
    }
  } else {
    surgeRadiusKm = undefined;
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.query.latitude = latitude;
  req.query.longitude = longitude;
  req.query.surgeRadiusKm = surgeRadiusKm;
  req.query.rideCategory = rideCategory;

  return next();
}

function validateDriverTripPreferences(req, res, next) {
  const errors = [];

  const serviceDogEnabled = parseBooleanField(errors, req.body?.serviceDogEnabled, 'serviceDogEnabled', {
    required: true,
    fallback: true,
  });
  const teenPickupEnabled = parseBooleanField(errors, req.body?.teenPickupEnabled, 'teenPickupEnabled', {
    required: true,
    fallback: false,
  });

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    serviceDogEnabled,
    teenPickupEnabled,
  };

  return next();
}

function validateVehiclePayload(req, res, next) {
  const errors = [];
  const make = parseRequiredString(errors, req.body?.make, 'make', { min: 2, max: 60 });
  const model = parseRequiredString(errors, req.body?.model, 'model', { min: 1, max: 60 });
  const yearNumber = toFiniteNumber(req.body?.year);
  const currentYear = new Date().getUTCFullYear();

  if (!Number.isInteger(yearNumber) || yearNumber < 1980 || yearNumber > currentYear + 1) {
    addError(errors, 'year', `must be an integer between 1980 and ${currentYear + 1}.`);
  }

  const plateNumber = parseRequiredString(errors, req.body?.plateNumber, 'plateNumber', { min: 3, max: 20 }).toUpperCase();
  if (plateNumber && !PLATE_REGEX.test(plateNumber)) {
    addError(errors, 'plateNumber', 'contains invalid characters.');
  }

  const color = parseOptionalString(errors, req.body?.color, 'color', { max: 40 }) || '';
  const photoUrl = parseOptionalString(errors, req.body?.photoUrl, 'photoUrl', { max: 500 });

  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
    addError(errors, 'photoUrl', 'must be a valid http or https URL.');
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    make,
    model,
    year: yearNumber,
    plateNumber,
    color,
    photoUrl,
  };

  return next();
}

function validateRiderRegistration(req, res, next) {
  return validateDriverRegistration(req, res, next);
}

function validateAddPaymentMethod(req, res, next) {
  const errors = [];
  const paymentMethodId = parseOptionalString(errors, req.body?.paymentMethodId, 'paymentMethodId', { max: 120 });

  const isDefault = parseBoolean(req.body?.isDefault, true);

  const hasPaymentMethodId = Boolean(paymentMethodId);

  let cardNumber = null;
  let expMonth = null;
  let expYear = null;
  let cvc = null;

  if (!hasPaymentMethodId) {
    cardNumber = parseRequiredString(errors, req.body?.cardNumber, 'cardNumber', { min: 12, max: 19 }).replace(/\s+/g, '');

    if (!/^\d{12,19}$/.test(cardNumber)) {
      addError(errors, 'cardNumber', 'must contain 12 to 19 digits.');
    }

    expMonth = toFiniteNumber(req.body?.expMonth);
    if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) {
      addError(errors, 'expMonth', 'must be an integer between 1 and 12.');
    }

    expYear = toFiniteNumber(req.body?.expYear);
    const currentYear = new Date().getUTCFullYear();
    if (!Number.isInteger(expYear) || expYear < currentYear || expYear > currentYear + 20) {
      addError(errors, 'expYear', `must be an integer between ${currentYear} and ${currentYear + 20}.`);
    }

    cvc = parseRequiredString(errors, req.body?.cvc, 'cvc', { min: 3, max: 4 });
    if (!/^\d{3,4}$/.test(cvc)) {
      addError(errors, 'cvc', 'must contain 3 or 4 digits.');
    }
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    paymentMethodId: hasPaymentMethodId ? paymentMethodId : undefined,
    cardNumber,
    expMonth,
    expYear,
    cvc,
    isDefault,
  };

  return next();
}

function validateNearbyDriversQuery(req, res, next) {
  const errors = [];

  const latitude = parseLatitude(errors, req.query?.latitude, 'query.latitude');
  const longitude = parseLongitude(errors, req.query?.longitude, 'query.longitude');

  const radiusKmRaw = req.query?.radiusKm;
  const limitRaw = req.query?.limit;

  let radiusKm = radiusKmRaw === undefined ? 5 : toFiniteNumber(radiusKmRaw);
  if (radiusKm === null || radiusKm < 0.1 || radiusKm > 50) {
    addError(errors, 'query.radiusKm', 'must be a number between 0.1 and 50.');
  }

  let limit = limitRaw === undefined ? 20 : toFiniteNumber(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    addError(errors, 'query.limit', 'must be an integer between 1 and 100.');
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.query.latitude = latitude;
  req.query.longitude = longitude;
  req.query.radiusKm = radiusKm;
  req.query.limit = limit;

  return next();
}

function validateAirportQueueStatusQuery(req, res, next) {
  const errors = [];

  parseObjectId(errors, req.params?.driverId, 'params.driverId');
  const rideCategory = parseRideCategory(errors, req.query?.rideCategory, 'query.rideCategory', {
    required: false,
    fallback: 'black_car',
  });

  const { latitude, longitude } = req.query || {};
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';

  if (hasLatitude !== hasLongitude) {
    addError(errors, 'query', 'latitude and longitude must be provided together.');
  }

  if (hasLatitude && hasLongitude) {
    req.query.latitude = parseLatitude(errors, latitude, 'query.latitude');
    req.query.longitude = parseLongitude(errors, longitude, 'query.longitude');
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.params.driverId = toTrimmedString(req.params.driverId);
  req.query.rideCategory = rideCategory;
  return next();
}

function validateAirportQueueEnter(req, res, next) {
  const errors = [];

  const driverId = parseObjectId(errors, req.body?.driverId, 'driverId');
  const airportCodeRaw = parseOptionalString(errors, req.body?.airportCode, 'airportCode', { max: 3 });
  const airportCode = airportCodeRaw ? airportCodeRaw.toUpperCase() : null;
  const queueTypeRaw = parseOptionalString(errors, req.body?.queueType, 'queueType', { max: 20 });
  const queueType = queueTypeRaw ? queueTypeRaw.toLowerCase() : undefined;
  const eventCodeRaw = parseOptionalString(errors, req.body?.eventCode, 'eventCode', { max: 40 });
  const eventCode = eventCodeRaw ? eventCodeRaw.toUpperCase() : null;
  const rideCategory = parseRideCategory(errors, req.body?.rideCategory, 'rideCategory', {
    required: false,
    fallback: 'black_car',
  });

  if (airportCode && !['ORD', 'MDW'].includes(airportCode)) {
    addError(errors, 'airportCode', 'must be ORD or MDW.');
  }

  if (queueType && !['airport', 'event'].includes(queueType)) {
    addError(errors, 'queueType', "must be either 'airport' or 'event'.");
  }

  if (eventCode && !['UNITED_CENTER', 'WRIGLEY_FIELD', 'SOLDIER_FIELD'].includes(eventCode)) {
    addError(errors, 'eventCode', 'must be one of: UNITED_CENTER, WRIGLEY_FIELD, SOLDIER_FIELD.');
  }

  const hasCoordinates = req.body?.latitude !== undefined && req.body?.longitude !== undefined;
  const latitude = hasCoordinates ? parseLatitude(errors, req.body.latitude, 'latitude') : null;
  const longitude = hasCoordinates ? parseLongitude(errors, req.body.longitude, 'longitude') : null;

  if (!hasCoordinates) {
    addError(errors, 'latitude', 'latitude and longitude are required for geofence queue enforcement.');
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    driverId,
    airportCode,
    eventCode,
    queueType,
    rideCategory,
    latitude,
    longitude,
  };

  return next();
}

function validateAirportQueueExit(req, res, next) {
  const errors = [];

  const driverId = parseObjectId(errors, req.body?.driverId, 'driverId');
  const airportCodeRaw = parseOptionalString(errors, req.body?.airportCode, 'airportCode', { max: 3 });
  const airportCode = airportCodeRaw ? airportCodeRaw.toUpperCase() : null;
  const eventCodeRaw = parseOptionalString(errors, req.body?.eventCode, 'eventCode', { max: 40 });
  const eventCode = eventCodeRaw ? eventCodeRaw.toUpperCase() : null;
  const queueTypeRaw = parseOptionalString(errors, req.body?.queueType, 'queueType', { max: 20 });
  const queueType = queueTypeRaw ? queueTypeRaw.toLowerCase() : undefined;

  if (airportCode && !['ORD', 'MDW'].includes(airportCode)) {
    addError(errors, 'airportCode', 'must be ORD or MDW.');
  }

  if (eventCode && !['UNITED_CENTER', 'WRIGLEY_FIELD', 'SOLDIER_FIELD'].includes(eventCode)) {
    addError(errors, 'eventCode', 'must be one of: UNITED_CENTER, WRIGLEY_FIELD, SOLDIER_FIELD.');
  }

  if (queueType && !['airport', 'event'].includes(queueType)) {
    addError(errors, 'queueType', "must be either 'airport' or 'event'.");
  }

  const reason = parseOptionalString(errors, req.body?.reason, 'reason', { max: 200 }) || 'Driver exited queue.';

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    driverId,
    airportCode,
    eventCode,
    queueType,
    reason,
  };

  return next();
}

function validateTripUpfrontPricing(req, res, next) {
  const errors = [];
  const bookingType = parseBookingType(errors, req.body?.bookingType, 'bookingType', {
    required: false,
    fallback: 'on_demand',
  });
  const pickup = parseTripPoint(errors, req.body?.pickup, 'pickup');
  const dropoffInput = bookingType === 'hourly' && !req.body?.dropoff ? req.body?.pickup : req.body?.dropoff;
  const dropoff = parseTripPoint(errors, dropoffInput, 'dropoff');
  const rideCategory = parseRideCategory(errors, req.body?.rideCategory, 'rideCategory', {
    required: false,
    fallback: 'black_car',
  });
  const scheduledAt = parseScheduledAt(errors, req.body?.scheduledAt, 'scheduledAt', {
    required: bookingType !== 'on_demand',
    minLeadMinutes: Number(process.env.RESERVATION_MIN_LEAD_MINUTES || 15),
  });
  const estimatedHours = parseEstimatedHours(errors, req.body?.estimatedHours, 'estimatedHours', {
    required: bookingType === 'hourly',
  });
  const serviceDogRequested = parseBoolean(req.body?.serviceDogRequested, false);
  const teenPickup = parseBoolean(req.body?.teenPickup, false);
  const teenSeatingPolicy = parseTeenSeatingPolicy(errors, req.body?.teenSeatingPolicy, 'teenSeatingPolicy', {
    teenPickup,
  });
  const specialInstructions = parseOptionalString(errors, req.body?.specialInstructions, 'specialInstructions', {
    max: 300,
  }) || '';

  if (bookingType === 'on_demand' && scheduledAt) {
    addError(errors, 'scheduledAt', 'is only supported for reservation or hourly bookings.');
  }

  if (bookingType !== 'hourly' && estimatedHours !== null) {
    addError(errors, 'estimatedHours', 'is only supported for hourly bookings.');
  }

  const isPrearranged = parseBoolean(req.body?.isPrearranged, bookingType !== 'on_demand' || Boolean(scheduledAt));

  if (bookingType !== 'on_demand' && !isPrearranged) {
    addError(errors, 'isPrearranged', 'must be true for reservation and hourly bookings.');
  }

  let surgeRadiusKm = req.body?.surgeRadiusKm;
  if (surgeRadiusKm !== undefined && surgeRadiusKm !== null && surgeRadiusKm !== '') {
    surgeRadiusKm = toFiniteNumber(surgeRadiusKm);
    if (surgeRadiusKm === null || surgeRadiusKm < 0.5 || surgeRadiusKm > 50) {
      addError(errors, 'surgeRadiusKm', 'must be between 0.5 and 50.');
    }
  } else {
    surgeRadiusKm = undefined;
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    pickup,
    dropoff,
    rideCategory,
    bookingType,
    scheduledAt,
    estimatedHours,
    serviceDogRequested,
    teenPickup,
    teenSeatingPolicy,
    specialInstructions,
    isPrearranged,
    surgeRadiusKm,
  };

  return next();
}

function validateTripRequest(req, res, next) {
  const errors = [];
  const bookingType = parseBookingType(errors, req.body?.bookingType, 'bookingType', {
    required: false,
    fallback: 'on_demand',
  });
  const riderId = parseObjectId(errors, req.body?.riderId, 'riderId');
  const pickup = parseTripPoint(errors, req.body?.pickup, 'pickup');
  const dropoffInput = bookingType === 'hourly' && !req.body?.dropoff ? req.body?.pickup : req.body?.dropoff;
  const dropoff = parseTripPoint(errors, dropoffInput, 'dropoff');
  const rideCategory = parseRideCategory(errors, req.body?.rideCategory, 'rideCategory', {
    required: false,
    fallback: 'black_car',
  });
  const scheduledAt = parseScheduledAt(errors, req.body?.scheduledAt, 'scheduledAt', {
    required: bookingType !== 'on_demand',
    minLeadMinutes: Number(process.env.RESERVATION_MIN_LEAD_MINUTES || 15),
  });
  const estimatedHours = parseEstimatedHours(errors, req.body?.estimatedHours, 'estimatedHours', {
    required: bookingType === 'hourly',
  });
  const serviceDogRequested = parseBoolean(req.body?.serviceDogRequested, false);
  const teenPickup = parseBoolean(req.body?.teenPickup, false);
  const teenSeatingPolicy = parseTeenSeatingPolicy(errors, req.body?.teenSeatingPolicy, 'teenSeatingPolicy', {
    teenPickup,
  });
  const specialInstructions = parseOptionalString(errors, req.body?.specialInstructions, 'specialInstructions', {
    max: 300,
  }) || '';

  if (bookingType === 'on_demand' && scheduledAt) {
    addError(errors, 'scheduledAt', 'is only supported for reservation or hourly bookings.');
  }

  if (bookingType !== 'hourly' && estimatedHours !== null) {
    addError(errors, 'estimatedHours', 'is only supported for hourly bookings.');
  }

  const isPrearranged = parseBoolean(req.body?.isPrearranged, bookingType !== 'on_demand' || Boolean(scheduledAt));

  if (bookingType !== 'on_demand' && !isPrearranged) {
    addError(errors, 'isPrearranged', 'must be true for reservation and hourly bookings.');
  }

  let surgeRadiusKm = req.body?.surgeRadiusKm;
  if (surgeRadiusKm !== undefined && surgeRadiusKm !== null && surgeRadiusKm !== '') {
    surgeRadiusKm = toFiniteNumber(surgeRadiusKm);
    if (surgeRadiusKm === null || surgeRadiusKm < 0.5 || surgeRadiusKm > 50) {
      addError(errors, 'surgeRadiusKm', 'must be between 0.5 and 50.');
    }
  } else {
    surgeRadiusKm = undefined;
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    riderId,
    pickup,
    dropoff,
    rideCategory,
    bookingType,
    scheduledAt,
    estimatedHours,
    serviceDogRequested,
    teenPickup,
    teenSeatingPolicy,
    specialInstructions,
    isPrearranged,
    surgeRadiusKm,
  };

  return next();
}

function validateTripDriverResponse(req, res, next) {
  const errors = [];
  const driverId = parseObjectId(errors, req.body?.driverId, 'driverId');
  const action = parseRequiredString(errors, req.body?.action, 'action', { min: 6, max: 7 }).toLowerCase();

  if (action && !['accept', 'decline'].includes(action)) {
    addError(errors, 'action', "must be either 'accept' or 'decline'.");
  }

  const declineReason = parseOptionalString(errors, req.body?.declineReason, 'declineReason', { max: 200 }) || undefined;

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    driverId,
    action,
    declineReason,
  };

  return next();
}

function validateTripActionPayloadInternal(req, res, next, { requireRoutePoint }) {
  const errors = [];
  const driverId = parseObjectId(errors, req.body?.driverId, 'driverId');

  let finalFare = req.body?.finalFare;
  if (finalFare !== undefined && finalFare !== null && finalFare !== '') {
    finalFare = toFiniteNumber(finalFare);
    if (finalFare === null || finalFare < 0) {
      addError(errors, 'finalFare', 'must be a non-negative number.');
    }
  } else {
    finalFare = null;
  }

  const routePointInput = req.body?.routePoint || req.body?.currentLocation;
  const hasInlineCoordinates = req.body?.latitude !== undefined && req.body?.longitude !== undefined;

  let routePoint = null;
  if (routePointInput) {
    routePoint = parseRoutePoint(errors, routePointInput, 'routePoint');
  } else if (hasInlineCoordinates) {
    routePoint = parseRoutePoint(errors, req.body, 'routePoint');
  } else if (requireRoutePoint) {
    addError(errors, 'routePoint', 'latitude and longitude are required for trip route tracking.');
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    driverId,
    finalFare,
    routePoint,
  };

  return next();
}

function validateTripActionPayload(req, res, next) {
  return validateTripActionPayloadInternal(req, res, next, {
    requireRoutePoint: false,
  });
}

function validateTripTrackPayload(req, res, next) {
  return validateTripActionPayloadInternal(req, res, next, {
    requireRoutePoint: true,
  });
}

function validateTripStatusUpdate(req, res, next) {
  const errors = [];
  const allowedStatus = new Set(['driver_arrived_pickup', 'in_progress', 'completed', 'cancelled']);
  const allowedActorTypes = new Set(['system', 'rider', 'driver', 'admin']);

  const status = parseRequiredString(errors, req.body?.status, 'status', { min: 3, max: 40 });
  if (status && !allowedStatus.has(status)) {
    addError(errors, 'status', `must be one of: ${Array.from(allowedStatus).join(', ')}.`);
  }

  const actorType = parseOptionalString(errors, req.body?.actorType, 'actorType', { max: 20 }) || 'system';
  if (actorType && !allowedActorTypes.has(actorType)) {
    addError(errors, 'actorType', `must be one of: ${Array.from(allowedActorTypes).join(', ')}.`);
  }

  const actorId = parseOptionalString(errors, req.body?.actorId, 'actorId', { max: 64 }) || null;
  const note = parseOptionalString(errors, req.body?.note, 'note', { max: 300 }) || '';
  const cancelReason = parseOptionalString(errors, req.body?.cancelReason, 'cancelReason', { max: 300 }) || '';

  let finalFare = req.body?.finalFare;
  if (finalFare !== undefined && finalFare !== null && finalFare !== '') {
    finalFare = toFiniteNumber(finalFare);
    if (finalFare === null || finalFare < 0) {
      addError(errors, 'finalFare', 'must be a non-negative number.');
    }
  } else {
    finalFare = null;
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    status,
    actorType,
    actorId,
    note,
    cancelReason,
    finalFare,
  };

  return next();
}

function validateTripTrackingQuery(req, res, next) {
  const errors = [];

  let limit = req.query?.limit;
  if (limit !== undefined && limit !== null && limit !== '') {
    limit = toFiniteNumber(limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      addError(errors, 'query.limit', 'must be an integer between 1 and 500.');
    }
  } else {
    limit = 100;
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.query.limit = limit;
  return next();
}

function validateTripTipUpdate(req, res, next) {
  const errors = [];
  const riderId = parseObjectId(errors, req.body?.riderId, 'riderId');

  let tipAmount = toFiniteNumber(req.body?.tipAmount);
  if (tipAmount === null) {
    addError(errors, 'tipAmount', 'is required and must be a number.');
  } else {
    if (tipAmount < 0) {
      addError(errors, 'tipAmount', 'must be a non-negative number.');
    }

    if (tipAmount > 1000) {
      addError(errors, 'tipAmount', 'must be at most 1000.');
    }

    tipAmount = Number((Math.round((tipAmount + Number.EPSILON) * 100) / 100).toFixed(2));
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    riderId,
    tipAmount,
  };

  return next();
}

function validateTripFeedbackUpdate(req, res, next) {
  const errors = [];
  const riderId = parseObjectId(errors, req.body?.riderId, 'riderId');

  const overallRating = parseOptionalRating(errors, req.body?.overallRating, 'overallRating');
  const driverProfessionalismRating = parseOptionalRating(
    errors,
    req.body?.driverProfessionalismRating,
    'driverProfessionalismRating'
  );
  const carCleanlinessRating = parseOptionalRating(errors, req.body?.carCleanlinessRating, 'carCleanlinessRating');
  const amenitiesRating = parseOptionalRating(errors, req.body?.amenitiesRating, 'amenitiesRating');
  const greetingRating = parseOptionalRating(errors, req.body?.greetingRating, 'greetingRating');

  let comments = null;
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'comments')) {
    const normalizedComments = parseOptionalString(errors, req.body?.comments, 'comments', { max: 500 });
    comments = normalizedComments === null ? '' : normalizedComments;
  }

  let tipAmount = null;
  if (req.body?.tipAmount !== undefined && req.body?.tipAmount !== null && req.body?.tipAmount !== '') {
    tipAmount = toFiniteNumber(req.body.tipAmount);

    if (tipAmount === null) {
      addError(errors, 'tipAmount', 'must be a number when provided.');
    } else {
      if (tipAmount < 0) {
        addError(errors, 'tipAmount', 'must be a non-negative number.');
      }

      if (tipAmount > 1000) {
        addError(errors, 'tipAmount', 'must be at most 1000.');
      }

      tipAmount = Number((Math.round((tipAmount + Number.EPSILON) * 100) / 100).toFixed(2));
    }
  }

  const hasFeedbackPayload =
    overallRating !== null ||
    driverProfessionalismRating !== null ||
    carCleanlinessRating !== null ||
    amenitiesRating !== null ||
    greetingRating !== null ||
    comments !== null ||
    tipAmount !== null;

  if (!hasFeedbackPayload) {
    addError(
      errors,
      'feedback',
      'include at least one value: overallRating, category ratings, comments, or tipAmount.'
    );
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    riderId,
    overallRating,
    driverProfessionalismRating,
    carCleanlinessRating,
    amenitiesRating,
    greetingRating,
    comments,
    tipAmount,
  };

  return next();
}

function validateTripDriverFeedbackUpdate(req, res, next) {
  const errors = [];
  const driverId = parseObjectId(errors, req.body?.driverId, 'driverId');

  const overallRating = parseOptionalRating(errors, req.body?.overallRating, 'overallRating');
  const safetyRating = parseOptionalRating(errors, req.body?.safetyRating, 'safetyRating');
  const respectRating = parseOptionalRating(errors, req.body?.respectRating, 'respectRating');

  let comments = null;
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'comments')) {
    const normalizedComments = parseOptionalString(errors, req.body?.comments, 'comments', { max: 500 });
    comments = normalizedComments === null ? '' : normalizedComments;
  }

  const hasFeedbackPayload = overallRating !== null || safetyRating !== null || respectRating !== null || comments !== null;

  if (!hasFeedbackPayload) {
    addError(errors, 'feedback', 'include at least one value: overallRating, safetyRating, respectRating, or comments.');
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    driverId,
    overallRating,
    safetyRating,
    respectRating,
    comments,
  };

  return next();
}

function validateTripActivation(req, res, next) {
  const errors = [];
  const force = parseBoolean(req.body?.force, false);

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.body = {
    force,
  };

  return next();
}

function validateAirportPickupInstructionsQuery(req, res, next) {
  const errors = [];
  const rideCategory = parseRideCategory(errors, req.query?.rideCategory, 'query.rideCategory', {
    required: false,
    fallback: 'black_car',
  });

  const { latitude, longitude } = req.query || {};
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';

  if (hasLatitude !== hasLongitude) {
    addError(errors, 'query', 'latitude and longitude must be provided together.');
  }

  if (hasLatitude && hasLongitude) {
    req.query.latitude = parseLatitude(errors, latitude, 'query.latitude');
    req.query.longitude = parseLongitude(errors, longitude, 'query.longitude');
  }

  if (errors.length) {
    return sendValidationError(res, errors);
  }

  req.query.rideCategory = rideCategory;

  return next();
}

module.exports = {
  validateIdParam,
  validateDriverRegistration,
  validateDriverDocumentUpload,
  validateDriverStatesPayload,
  validateDriverChauffeurLicenseVerification,
  validateDriverSurgeQuery,
  validateDriverTripPreferences,
  validateVehiclePayload,
  validateRiderRegistration,
  validateAddPaymentMethod,
  validateNearbyDriversQuery,
  validateAirportQueueStatusQuery,
  validateAirportQueueEnter,
  validateAirportQueueExit,
  validateAirportPickupInstructionsQuery,
  validateTripUpfrontPricing,
  validateTripRequest,
  validateTripDriverResponse,
  validateTripActionPayload,
  validateTripTrackPayload,
  validateTripStatusUpdate,
  validateTripTrackingQuery,
  validateTripTipUpdate,
  validateTripFeedbackUpdate,
  validateTripDriverFeedbackUpdate,
  validateTripActivation,
  _private: {
    parseTripPoint,
    parseRoutePoint,
    parseObjectId,
    parseBoolean,
    toFiniteNumber,
  },
};
