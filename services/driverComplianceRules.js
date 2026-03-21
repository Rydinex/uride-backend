const DEFAULT_OPERATING_STATE = 'IL';

const PREMIUM_RIDE_CATEGORIES = Object.freeze(['black_car', 'black_suv']);

const CHICAGO_PREMIUM_REQUIRED_DOCUMENTS = Object.freeze([
  'chauffeur_license_or_taxi_chauffeur_license',
  'hard_card',
  'state_driver_license',
  'commercial_insurance',
  'vehicle_registration',
  'profile_picture',
  'background_check',
]);

const STATE_RULES = {
  IL: {
    code: 'IL',
    name: 'Illinois',
    chauffeurLicenseRequired: true,
    vehicleInspectionIntervalDays: 180,
    backgroundCheckRenewalDays: 365,
    requiredDocuments: [...CHICAGO_PREMIUM_REQUIRED_DOCUMENTS, 'vehicle_inspection'],
    notes: [
      'Black Car and Black SUV are premium services in Chicago.',
      'Premium drivers must hold a city chauffeur credential (or taxi chauffeur credential) and hard card.',
      'Chicago airport pickups require active airport queue participation.',
      'Display chauffeur permit number in driver profile.',
    ],
  },
  IN: {
    code: 'IN',
    name: 'Indiana',
    chauffeurLicenseRequired: false,
    vehicleInspectionIntervalDays: 365,
    backgroundCheckRenewalDays: 365,
    requiredDocuments: ['license', 'insurance', 'vehicle_registration', 'vehicle_inspection'],
    notes: ['State allows standard rideshare licensing for non-limo trips.'],
  },
  WI: {
    code: 'WI',
    name: 'Wisconsin',
    chauffeurLicenseRequired: false,
    vehicleInspectionIntervalDays: 365,
    backgroundCheckRenewalDays: 365,
    requiredDocuments: ['license', 'insurance', 'vehicle_registration', 'vehicle_inspection'],
    notes: ['Maintain printed insurance proof in vehicle.'],
  },
  MI: {
    code: 'MI',
    name: 'Michigan',
    chauffeurLicenseRequired: true,
    vehicleInspectionIntervalDays: 365,
    backgroundCheckRenewalDays: 365,
    requiredDocuments: ['license', 'insurance', 'vehicle_registration', 'vehicle_inspection', 'chauffeur_license'],
    notes: ['Chauffeur license required for for-hire passenger transport.'],
  },
  NY: {
    code: 'NY',
    name: 'New York',
    chauffeurLicenseRequired: true,
    vehicleInspectionIntervalDays: 180,
    backgroundCheckRenewalDays: 365,
    requiredDocuments: ['license', 'insurance', 'vehicle_registration', 'vehicle_inspection', 'chauffeur_license'],
    notes: ['Additional TLC requirements may apply in NYC.', 'Airport dispatch instructions can vary by terminal authority.'],
  },
  TX: {
    code: 'TX',
    name: 'Texas',
    chauffeurLicenseRequired: false,
    vehicleInspectionIntervalDays: 365,
    backgroundCheckRenewalDays: 365,
    requiredDocuments: ['license', 'insurance', 'vehicle_registration', 'vehicle_inspection'],
    notes: ['Use local city permits where required.'],
  },
  CA: {
    code: 'CA',
    name: 'California',
    chauffeurLicenseRequired: false,
    vehicleInspectionIntervalDays: 365,
    backgroundCheckRenewalDays: 365,
    requiredDocuments: ['license', 'insurance', 'vehicle_registration', 'vehicle_inspection'],
    notes: ['Follow airport geofence and permit rules per county/airport authority.'],
  },
  FL: {
    code: 'FL',
    name: 'Florida',
    chauffeurLicenseRequired: false,
    vehicleInspectionIntervalDays: 365,
    backgroundCheckRenewalDays: 365,
    requiredDocuments: ['license', 'insurance', 'vehicle_registration', 'vehicle_inspection'],
    notes: ['Airport commercial lane permits may be required for pickups.'],
  },
};

function normalizeStateCode(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim().toUpperCase();
}

function toStateCodeArray(values) {
  if (Array.isArray(values)) {
    return values.map(normalizeStateCode).filter(Boolean);
  }

  if (typeof values === 'string') {
    return values
      .split(',')
      .map(normalizeStateCode)
      .filter(Boolean);
  }

  return [];
}

function dedupeStateCodes(values) {
  return Array.from(new Set(toStateCodeArray(values)));
}

function getStateRule(stateCode) {
  const normalized = normalizeStateCode(stateCode);
  return STATE_RULES[normalized] || null;
}

function resolveStateRules(stateCodesInput) {
  const requestedStateCodes = dedupeStateCodes(stateCodesInput);
  const requested = requestedStateCodes.length ? requestedStateCodes : [DEFAULT_OPERATING_STATE];

  const supported = [];
  const unsupported = [];

  requested.forEach(stateCode => {
    const stateRule = getStateRule(stateCode);
    if (stateRule) {
      supported.push(stateRule);
      return;
    }

    unsupported.push(stateCode);
  });

  return {
    operatingStates: supported.map(state => state.code),
    rules: supported,
    unsupportedStates: unsupported,
  };
}

module.exports = {
  DEFAULT_OPERATING_STATE,
  PREMIUM_RIDE_CATEGORIES,
  CHICAGO_PREMIUM_REQUIRED_DOCUMENTS,
  STATE_RULES,
  normalizeStateCode,
  dedupeStateCodes,
  getStateRule,
  resolveStateRules,
};
