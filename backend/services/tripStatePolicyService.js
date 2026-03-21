const fs = require('fs');
const path = require('path');

const { normalizeRideCategory } = require('./configService');

const DEFAULT_COUNTRY_CODE = 'US';
const DEFAULT_TRIP_STATE = 'IL';
const DEFAULT_TRIP_STATE_POLICY_FILE = path.join(__dirname, '..', 'config', 'tripStateRules.json');

const DEFAULT_LEG_RULE = Object.freeze({
  allow: true,
  allowedRideCategories: null,
  requirePrearranged: false,
});

const US_STATE_CATALOG = Object.freeze({
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
});

const US_STATE_CODES = new Set(Object.keys(US_STATE_CATALOG));

function buildBuiltinUsStateRules() {
  const states = {};

  Object.entries(US_STATE_CATALOG).forEach(([stateCode, stateName]) => {
    states[stateCode] = {
      name: stateName,
    };
  });

  states.IL = {
    name: 'Illinois',
    notes: ['All categories and pickups are allowed.'],
  };

  states.IN = {
    name: 'Indiana',
    pickup: {
      allow: true,
      allowedRideCategories: ['black_car'],
      requirePrearranged: true,
    },
    dropoff: {
      allow: true,
      allowedRideCategories: null,
      requirePrearranged: false,
    },
    notes: ['Only pre-arranged black car pickups are allowed.', 'All dropoffs are allowed.'],
  };

  states.WI = {
    name: 'Wisconsin',
    pickup: {
      allow: true,
      allowedRideCategories: ['black_car'],
      requirePrearranged: true,
    },
    dropoff: {
      allow: true,
      allowedRideCategories: null,
      requirePrearranged: false,
    },
    notes: ['Only pre-arranged black car pickups are allowed.', 'All dropoffs are allowed.'],
  };

  return states;
}

const BUILTIN_TRIP_STATE_POLICY = Object.freeze({
  version: 'builtin-v2-global-jurisdiction',
  defaultCountryCode: DEFAULT_COUNTRY_CODE,
  defaultStateCode: DEFAULT_TRIP_STATE,
  defaultRule: {
    pickup: { ...DEFAULT_LEG_RULE },
    dropoff: { ...DEFAULT_LEG_RULE },
  },
  countries: {
    US: {
      code: 'US',
      name: 'United States',
      defaultStateCode: DEFAULT_TRIP_STATE,
      defaultRule: {
        pickup: { ...DEFAULT_LEG_RULE },
        dropoff: { ...DEFAULT_LEG_RULE },
      },
      states: buildBuiltinUsStateRules(),
      cities: {},
    },
  },
});

let cachedPolicyConfig = null;
let cachedPolicySource = null;
let cachedPolicyMtimeMs = null;
let cachedPolicyEnvSignature = null;

function normalizeStateCode(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const normalized = String(value).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : '';
}

function normalizeCountryCode(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const normalized = String(value).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : '';
}

function normalizeCityName(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\0/g, '').trim().replace(/\s+/g, ' ');
}

function normalizeCityKey(value) {
  const normalizedName = normalizeCityName(value);
  return normalizedName ? normalizedName.toUpperCase() : '';
}

function normalizeAllowedRideCategories(value, fallbackValue = null) {
  if (value === undefined) {
    return Array.isArray(fallbackValue) ? [...fallbackValue] : fallbackValue;
  }

  if (value === null || value === '*' || value === 'all') {
    return null;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = Array.from(
    new Set(
      value
        .map(item => normalizeRideCategory(item))
        .filter(Boolean)
    )
  );

  return normalized;
}

function normalizeLegRule(rawLegRule = {}, fallbackLegRule = DEFAULT_LEG_RULE) {
  const source = rawLegRule && typeof rawLegRule === 'object' ? rawLegRule : {};
  const fallback = fallbackLegRule && typeof fallbackLegRule === 'object' ? fallbackLegRule : DEFAULT_LEG_RULE;

  return {
    allow: source.allow === undefined ? Boolean(fallback.allow) : Boolean(source.allow),
    allowedRideCategories: normalizeAllowedRideCategories(source.allowedRideCategories, fallback.allowedRideCategories),
    requirePrearranged:
      source.requirePrearranged === undefined
        ? Boolean(fallback.requirePrearranged)
        : Boolean(source.requirePrearranged),
  };
}

function normalizeNotes(notes, fallbackNotes = []) {
  const source = Array.isArray(notes) ? notes : Array.isArray(fallbackNotes) ? fallbackNotes : [];
  return source
    .map(note => String(note || '').trim())
    .filter(Boolean);
}

function normalizeStateRule(stateCode, rawStateRule = {}, fallbackStateRule = null, countryDefaultRule = null) {
  const source = rawStateRule && typeof rawStateRule === 'object' ? rawStateRule : {};
  const fallback = fallbackStateRule && typeof fallbackStateRule === 'object' ? fallbackStateRule : {};
  const defaultRule = countryDefaultRule && typeof countryDefaultRule === 'object' ? countryDefaultRule : {};

  return {
    code: stateCode,
    name:
      typeof source.name === 'string' && source.name.trim()
        ? source.name.trim()
        : typeof fallback.name === 'string' && fallback.name.trim()
        ? fallback.name.trim()
        : stateCode,
    pickup: normalizeLegRule(source.pickup, fallback.pickup || defaultRule.pickup || DEFAULT_LEG_RULE),
    dropoff: normalizeLegRule(source.dropoff, fallback.dropoff || defaultRule.dropoff || DEFAULT_LEG_RULE),
    notes: normalizeNotes(source.notes, fallback.notes),
  };
}

function normalizeCityRule(cityKey, rawCityRule = {}, fallbackCityRule = null, countryDefaultRule = null) {
  const source = rawCityRule && typeof rawCityRule === 'object' ? rawCityRule : {};
  const fallback = fallbackCityRule && typeof fallbackCityRule === 'object' ? fallbackCityRule : {};
  const defaultRule = countryDefaultRule && typeof countryDefaultRule === 'object' ? countryDefaultRule : {};

  const sourceStateCode = normalizeStateCode(source.stateCode);
  const fallbackStateCode = normalizeStateCode(fallback.stateCode);

  return {
    key: cityKey,
    name:
      normalizeCityName(source.name) ||
      normalizeCityName(fallback.name) ||
      cityKey,
    stateCode: sourceStateCode || fallbackStateCode || null,
    pickup: normalizeLegRule(source.pickup, fallback.pickup || defaultRule.pickup || DEFAULT_LEG_RULE),
    dropoff: normalizeLegRule(source.dropoff, fallback.dropoff || defaultRule.dropoff || DEFAULT_LEG_RULE),
    notes: normalizeNotes(source.notes, fallback.notes),
  };
}

function normalizeCountryRule(
  countryCode,
  rawCountryRule = {},
  fallbackCountryRule = null,
  policyDefaultRule = null,
  policyDefaultStateCode = ''
) {
  const source = rawCountryRule && typeof rawCountryRule === 'object' ? rawCountryRule : {};
  const fallback = fallbackCountryRule && typeof fallbackCountryRule === 'object' ? fallbackCountryRule : {};
  const fallbackPolicyDefault = policyDefaultRule && typeof policyDefaultRule === 'object' ? policyDefaultRule : {};

  const defaultRule = {
    pickup: normalizeLegRule(source.defaultRule?.pickup, fallback.defaultRule?.pickup || fallbackPolicyDefault.pickup),
    dropoff: normalizeLegRule(source.defaultRule?.dropoff, fallback.defaultRule?.dropoff || fallbackPolicyDefault.dropoff),
  };

  const states = {};

  Object.keys(fallback.states || {}).forEach(fallbackStateCode => {
    const normalizedStateCode = normalizeStateCode(fallbackStateCode);
    if (!normalizedStateCode) {
      return;
    }

    states[normalizedStateCode] = normalizeStateRule(
      normalizedStateCode,
      fallback.states[fallbackStateCode],
      null,
      defaultRule
    );
  });

  if (source.states && typeof source.states === 'object') {
    Object.keys(source.states).forEach(rawStateCode => {
      const normalizedStateCode = normalizeStateCode(rawStateCode);
      if (!normalizedStateCode) {
        return;
      }

      states[normalizedStateCode] = normalizeStateRule(
        normalizedStateCode,
        source.states[rawStateCode],
        states[normalizedStateCode] || null,
        defaultRule
      );
    });
  }

  const cities = {};

  Object.keys(fallback.cities || {}).forEach(rawCityKey => {
    const normalizedCityKey = normalizeCityKey(rawCityKey);
    if (!normalizedCityKey) {
      return;
    }

    cities[normalizedCityKey] = normalizeCityRule(
      normalizedCityKey,
      fallback.cities[rawCityKey],
      null,
      defaultRule
    );
  });

  if (source.cities && typeof source.cities === 'object') {
    Object.keys(source.cities).forEach(rawCityKey => {
      const normalizedCityKey = normalizeCityKey(rawCityKey);
      if (!normalizedCityKey) {
        return;
      }

      cities[normalizedCityKey] = normalizeCityRule(
        normalizedCityKey,
        source.cities[rawCityKey],
        cities[normalizedCityKey] || null,
        defaultRule
      );
    });
  }

  const fallbackDefaultStateCode =
    normalizeStateCode(fallback.defaultStateCode) ||
    normalizeStateCode(policyDefaultStateCode) ||
    '';

  const defaultStateCode = normalizeStateCode(source.defaultStateCode) || fallbackDefaultStateCode;

  return {
    code: countryCode,
    name:
      typeof source.name === 'string' && source.name.trim()
        ? source.name.trim()
        : typeof fallback.name === 'string' && fallback.name.trim()
        ? fallback.name.trim()
        : countryCode,
    defaultStateCode,
    defaultRule,
    states,
    cities,
  };
}

function mergeLegacyCountryShape(sourceConfig, defaultCountryCode) {
  if (!sourceConfig || typeof sourceConfig !== 'object') {
    return {};
  }

  if (!sourceConfig.states && !sourceConfig.cities && !sourceConfig.defaultStateCode && !sourceConfig.defaultRule) {
    return {};
  }

  const legacyCountry = {
    ...(sourceConfig.defaultStateCode ? { defaultStateCode: sourceConfig.defaultStateCode } : {}),
    ...(sourceConfig.defaultRule ? { defaultRule: sourceConfig.defaultRule } : {}),
    ...(sourceConfig.states ? { states: sourceConfig.states } : {}),
    ...(sourceConfig.cities ? { cities: sourceConfig.cities } : {}),
  };

  return {
    [defaultCountryCode]: legacyCountry,
  };
}

function normalizePolicyConfig(rawConfig = {}, fallbackConfig = BUILTIN_TRIP_STATE_POLICY) {
  const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const fallback = fallbackConfig && typeof fallbackConfig === 'object' ? fallbackConfig : BUILTIN_TRIP_STATE_POLICY;

  const defaultRule = {
    pickup: normalizeLegRule(source.defaultRule?.pickup, fallback.defaultRule?.pickup || DEFAULT_LEG_RULE),
    dropoff: normalizeLegRule(source.defaultRule?.dropoff, fallback.defaultRule?.dropoff || DEFAULT_LEG_RULE),
  };

  const fallbackDefaultCountryCode = normalizeCountryCode(fallback.defaultCountryCode) || DEFAULT_COUNTRY_CODE;
  const defaultCountryCode = normalizeCountryCode(source.defaultCountryCode) || fallbackDefaultCountryCode;
  const defaultStateCode =
    normalizeStateCode(source.defaultStateCode) ||
    normalizeStateCode(fallback.defaultStateCode) ||
    DEFAULT_TRIP_STATE;

  const countries = {};

  Object.keys(fallback.countries || {}).forEach(rawCountryCode => {
    const countryCode = normalizeCountryCode(rawCountryCode);
    if (!countryCode) {
      return;
    }

    countries[countryCode] = normalizeCountryRule(
      countryCode,
      fallback.countries[rawCountryCode],
      null,
      defaultRule,
      defaultStateCode
    );
  });

  const sourceCountries = {};

  if (source.countries && typeof source.countries === 'object') {
    Object.keys(source.countries).forEach(rawCountryCode => {
      const countryCode = normalizeCountryCode(rawCountryCode);
      if (!countryCode) {
        return;
      }

      sourceCountries[countryCode] = source.countries[rawCountryCode];
    });
  }

  const legacyCountries = mergeLegacyCountryShape(source, defaultCountryCode);

  Object.keys(legacyCountries).forEach(countryCode => {
    const existing = sourceCountries[countryCode] && typeof sourceCountries[countryCode] === 'object'
      ? sourceCountries[countryCode]
      : {};
    const legacy = legacyCountries[countryCode] && typeof legacyCountries[countryCode] === 'object'
      ? legacyCountries[countryCode]
      : {};

    sourceCountries[countryCode] = {
      ...existing,
      ...legacy,
      states: {
        ...(existing.states && typeof existing.states === 'object' ? existing.states : {}),
        ...(legacy.states && typeof legacy.states === 'object' ? legacy.states : {}),
      },
      cities: {
        ...(existing.cities && typeof existing.cities === 'object' ? existing.cities : {}),
        ...(legacy.cities && typeof legacy.cities === 'object' ? legacy.cities : {}),
      },
    };
  });

  Object.keys(sourceCountries).forEach(countryCode => {
    countries[countryCode] = normalizeCountryRule(
      countryCode,
      sourceCountries[countryCode],
      countries[countryCode] || null,
      defaultRule,
      defaultStateCode
    );
  });

  if (!countries[defaultCountryCode]) {
    countries[defaultCountryCode] = normalizeCountryRule(
      defaultCountryCode,
      {},
      null,
      defaultRule,
      defaultStateCode
    );
  }

  return {
    version:
      typeof source.version === 'string' && source.version.trim()
        ? source.version.trim()
        : typeof fallback.version === 'string' && fallback.version.trim()
        ? fallback.version.trim()
        : 'builtin-v2-global-jurisdiction',
    defaultCountryCode,
    defaultStateCode,
    defaultRule,
    countries,
  };
}

function resolvePolicyFilePath() {
  return process.env.TRIP_STATE_POLICY_FILE
    ? path.resolve(process.env.TRIP_STATE_POLICY_FILE)
    : DEFAULT_TRIP_STATE_POLICY_FILE;
}

function cachePolicy(policyConfig, { source, mtimeMs = null, envSignature = null }) {
  cachedPolicyConfig = policyConfig;
  cachedPolicySource = source;
  cachedPolicyMtimeMs = mtimeMs;
  cachedPolicyEnvSignature = envSignature;
}

function loadPolicyFromEnv() {
  const jsonValue = process.env.TRIP_STATE_POLICY_JSON;
  if (!jsonValue) {
    return null;
  }

  if (cachedPolicyConfig && cachedPolicySource === 'env' && cachedPolicyEnvSignature === jsonValue) {
    return cachedPolicyConfig;
  }

  try {
    const parsed = JSON.parse(jsonValue);
    const policyConfig = normalizePolicyConfig(parsed);
    cachePolicy(policyConfig, { source: 'env', envSignature: jsonValue });
    return policyConfig;
  } catch (_error) {
    return null;
  }
}

function loadPolicyFromFile() {
  const filePath = resolvePolicyFilePath();

  try {
    const stats = fs.statSync(filePath);

    if (
      cachedPolicyConfig &&
      cachedPolicySource === filePath &&
      cachedPolicyMtimeMs === stats.mtimeMs
    ) {
      return cachedPolicyConfig;
    }

    const rawFile = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(rawFile);
    const policyConfig = normalizePolicyConfig(parsed);

    cachePolicy(policyConfig, {
      source: filePath,
      mtimeMs: stats.mtimeMs,
    });

    return policyConfig;
  } catch (_error) {
    return null;
  }
}

function getTripStatePolicyConfig() {
  const fromEnv = loadPolicyFromEnv();
  if (fromEnv) {
    return {
      ...fromEnv,
      source: 'env',
    };
  }

  const fromFile = loadPolicyFromFile();
  if (fromFile) {
    return {
      ...fromFile,
      source: cachedPolicySource || 'file',
    };
  }

  const fallback = normalizePolicyConfig(BUILTIN_TRIP_STATE_POLICY, BUILTIN_TRIP_STATE_POLICY);
  cachePolicy(fallback, {
    source: 'builtin',
  });

  return {
    ...fallback,
    source: 'builtin',
  };
}

function extractStateCodeFromAddress(address) {
  if (!address || typeof address !== 'string') {
    return '';
  }

  const tokens = address.toUpperCase().match(/\b[A-Z]{2}\b/g) || [];

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (US_STATE_CODES.has(token)) {
      return token;
    }
  }

  return '';
}

function resolvePointCountry(point, fallbackCountryCode = DEFAULT_COUNTRY_CODE) {
  const directCountryCode = normalizeCountryCode(point?.country);
  if (directCountryCode) {
    return {
      countryCode: directCountryCode,
      source: 'point',
    };
  }

  const fallback = normalizeCountryCode(fallbackCountryCode) || DEFAULT_COUNTRY_CODE;
  return {
    countryCode: fallback,
    source: 'default',
  };
}

function resolvePointState(point, fallbackStateCode = DEFAULT_TRIP_STATE) {
  const directStateCode = normalizeStateCode(point?.state);
  if (directStateCode) {
    return {
      stateCode: directStateCode,
      source: 'point',
    };
  }

  const addressStateCode = extractStateCodeFromAddress(point?.address);
  if (addressStateCode) {
    return {
      stateCode: addressStateCode,
      source: 'address',
    };
  }

  const fallback = normalizeStateCode(fallbackStateCode) || DEFAULT_TRIP_STATE;
  return {
    stateCode: fallback,
    source: 'default',
  };
}

function resolvePointCity(point) {
  const cityName = normalizeCityName(point?.city);
  if (cityName) {
    return {
      cityName,
      cityKey: normalizeCityKey(cityName),
      source: 'point',
    };
  }

  return {
    cityName: '',
    cityKey: '',
    source: 'default',
  };
}

function getAppliedLegRule(policyConfig, jurisdictionOrState, leg) {
  const jurisdiction =
    jurisdictionOrState && typeof jurisdictionOrState === 'object'
      ? jurisdictionOrState
      : { stateCode: jurisdictionOrState };

  const countryCode =
    normalizeCountryCode(jurisdiction.countryCode) ||
    normalizeCountryCode(policyConfig.defaultCountryCode) ||
    DEFAULT_COUNTRY_CODE;

  const countryRule = policyConfig.countries[countryCode] || null;

  const fallbackStateCode =
    normalizeStateCode(jurisdiction.stateCode) ||
    normalizeStateCode(countryRule?.defaultStateCode) ||
    normalizeStateCode(policyConfig.defaultStateCode) ||
    '';

  const stateCode = fallbackStateCode;
  const stateRule = stateCode && countryRule?.states ? countryRule.states[stateCode] || null : null;

  const cityKey = normalizeCityKey(jurisdiction.cityName);
  let cityRule = null;

  if (cityKey && countryRule?.cities?.[cityKey]) {
    const matchedCityRule = countryRule.cities[cityKey];
    if (!matchedCityRule.stateCode || !stateCode || matchedCityRule.stateCode === stateCode) {
      cityRule = matchedCityRule;
    }
  }

  const legRule =
    cityRule?.[leg] ||
    stateRule?.[leg] ||
    countryRule?.defaultRule?.[leg] ||
    policyConfig.defaultRule?.[leg] ||
    DEFAULT_LEG_RULE;

  return {
    countryCode,
    countryName: countryRule?.name || countryCode || 'Unknown country',
    stateCode,
    stateName: stateRule?.name || stateCode || 'Unknown state',
    cityName: cityRule?.name || (cityKey ? normalizeCityName(jurisdiction.cityName) : null),
    matchedCityKey: cityRule ? cityKey : null,
    isConfiguredCountry: Boolean(countryRule),
    isConfiguredState: Boolean(stateRule),
    isConfiguredCity: Boolean(cityRule),
    rule: {
      allow: Boolean(legRule.allow),
      allowedRideCategories: Array.isArray(legRule.allowedRideCategories)
        ? [...legRule.allowedRideCategories]
        : null,
      requirePrearranged: Boolean(legRule.requirePrearranged),
    },
  };
}

function formatAllowedCategories(allowedRideCategories) {
  if (!Array.isArray(allowedRideCategories) || !allowedRideCategories.length) {
    return 'none';
  }

  return allowedRideCategories.join(', ');
}

function getRuleLocationLabel(appliedRule) {
  if (appliedRule.isConfiguredCity && appliedRule.cityName) {
    if (appliedRule.stateCode) {
      return `${appliedRule.cityName}, ${appliedRule.stateCode}`;
    }

    return `${appliedRule.cityName}, ${appliedRule.countryCode}`;
  }

  if (appliedRule.isConfiguredState && appliedRule.stateName) {
    return appliedRule.stateName;
  }

  if (appliedRule.countryName) {
    return appliedRule.countryName;
  }

  return 'the selected jurisdiction';
}

function evaluateLeg({ leg, appliedRule, rideCategory, isPrearranged }) {
  const legLabel = leg === 'pickup' ? 'Pickup' : 'Dropoff';
  const ruleLocation = getRuleLocationLabel(appliedRule);
  const violations = [];

  if (!appliedRule.rule.allow) {
    violations.push({
      code: `${leg}_blocked`,
      leg,
      countryCode: appliedRule.countryCode || null,
      stateCode: appliedRule.stateCode || null,
      cityName: appliedRule.cityName || null,
      message: `${legLabel} trips are not allowed in ${ruleLocation}.`,
    });

    return violations;
  }

  if (
    Array.isArray(appliedRule.rule.allowedRideCategories) &&
    !appliedRule.rule.allowedRideCategories.includes(rideCategory)
  ) {
    violations.push({
      code: `${leg}_category_not_allowed`,
      leg,
      countryCode: appliedRule.countryCode || null,
      stateCode: appliedRule.stateCode || null,
      cityName: appliedRule.cityName || null,
      message: `${legLabel} in ${ruleLocation} allows only: ${formatAllowedCategories(
        appliedRule.rule.allowedRideCategories
      )}.`,
    });
  }

  if (appliedRule.rule.requirePrearranged && !isPrearranged) {
    violations.push({
      code: `${leg}_requires_prearranged`,
      leg,
      countryCode: appliedRule.countryCode || null,
      stateCode: appliedRule.stateCode || null,
      cityName: appliedRule.cityName || null,
      message: `${legLabel} in ${ruleLocation} must be pre-arranged.`,
    });
  }

  return violations;
}

function evaluateTripStatePolicy({
  pickup,
  dropoff,
  rideCategory = 'rydinex_regular',
  isPrearranged = false,
} = {}) {
  const policyConfig = getTripStatePolicyConfig();

  const normalizedRideCategory = normalizeRideCategory(rideCategory) || 'rydinex_regular';
  const normalizedIsPrearranged = Boolean(isPrearranged);

  const pickupCountry = resolvePointCountry(pickup, policyConfig.defaultCountryCode || DEFAULT_COUNTRY_CODE);
  const dropoffCountry = resolvePointCountry(dropoff, policyConfig.defaultCountryCode || DEFAULT_COUNTRY_CODE);

  const pickupCountryRule = policyConfig.countries[pickupCountry.countryCode] || null;
  const dropoffCountryRule = policyConfig.countries[dropoffCountry.countryCode] || null;

  const pickupState = resolvePointState(
    pickup,
    pickupCountryRule?.defaultStateCode || policyConfig.defaultStateCode || DEFAULT_TRIP_STATE
  );

  const dropoffState = resolvePointState(
    dropoff,
    dropoffCountryRule?.defaultStateCode || policyConfig.defaultStateCode || DEFAULT_TRIP_STATE
  );

  const pickupCity = resolvePointCity(pickup);
  const dropoffCity = resolvePointCity(dropoff);

  const appliedPickupRule = getAppliedLegRule(
    policyConfig,
    {
      countryCode: pickupCountry.countryCode,
      stateCode: pickupState.stateCode,
      cityName: pickupCity.cityName,
    },
    'pickup'
  );

  const appliedDropoffRule = getAppliedLegRule(
    policyConfig,
    {
      countryCode: dropoffCountry.countryCode,
      stateCode: dropoffState.stateCode,
      cityName: dropoffCity.cityName,
    },
    'dropoff'
  );

  const violations = [
    ...evaluateLeg({
      leg: 'pickup',
      appliedRule: appliedPickupRule,
      rideCategory: normalizedRideCategory,
      isPrearranged: normalizedIsPrearranged,
    }),
    ...evaluateLeg({
      leg: 'dropoff',
      appliedRule: appliedDropoffRule,
      rideCategory: normalizedRideCategory,
      isPrearranged: normalizedIsPrearranged,
    }),
  ];

  return {
    isAllowed: violations.length === 0,
    policyVersion: policyConfig.version,
    policySource: policyConfig.source,
    rideCategory: normalizedRideCategory,
    isPrearranged: normalizedIsPrearranged,
    pickupCountryCode: pickupCountry.countryCode || null,
    dropoffCountryCode: dropoffCountry.countryCode || null,
    pickupCountrySource: pickupCountry.source,
    dropoffCountrySource: dropoffCountry.source,
    pickupStateCode: pickupState.stateCode || null,
    dropoffStateCode: dropoffState.stateCode || null,
    pickupStateSource: pickupState.source,
    dropoffStateSource: dropoffState.source,
    pickupCity: pickupCity.cityName || null,
    dropoffCity: dropoffCity.cityName || null,
    pickupCitySource: pickupCity.source,
    dropoffCitySource: dropoffCity.source,
    appliedRules: {
      pickup: appliedPickupRule,
      dropoff: appliedDropoffRule,
    },
    violations,
  };
}

function clearPolicyCache() {
  cachedPolicyConfig = null;
  cachedPolicySource = null;
  cachedPolicyMtimeMs = null;
  cachedPolicyEnvSignature = null;
}

module.exports = {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_TRIP_STATE,
  BUILTIN_TRIP_STATE_POLICY,
  normalizeStateCode,
  normalizeCountryCode,
  normalizeCityKey,
  extractStateCodeFromAddress,
  evaluateTripStatePolicy,
  getTripStatePolicyConfig,
  __private: {
    normalizeLegRule,
    normalizeStateRule,
    normalizeCityRule,
    normalizeCountryRule,
    normalizePolicyConfig,
    clearPolicyCache,
    resolvePointState,
    resolvePointCountry,
    resolvePointCity,
    getAppliedLegRule,
  },
};
