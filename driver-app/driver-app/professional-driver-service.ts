/**
 * Professional Driver Service
 * Manages Rydinex Black driver profiles, vehicles, documents, and state regulations
 */

export type VehicleType = 'black-car' | 'black-suv';
export type DocumentType = 'chauffeur-license' | 'driver-license' | 'livery-card' | 'background-check' | 'insurance' | 'profile-picture';
export type ComplianceStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'under-review';

export interface Document {
  id: string;
  type: DocumentType;
  status: ComplianceStatus;
  uploadedAt: string;
  expiresAt: string | null;
  verifiedAt: string | null;
  notes: string;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  vin: string;
  mileage: number;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceExpiresAt: string;
  photos: string[];
  registeredAt: string;
  status: ComplianceStatus;
}

export interface ProfessionalDriver {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ssn: string; // Last 4 digits only
  dateOfBirth: string;
  state: string;
  city: string;
  address: string;
  profilePicture: string;
  documents: Document[];
  vehicles: Vehicle[];
  backgroundCheckStatus: ComplianceStatus;
  backgroundCheckDate: string | null;
  overallStatus: ComplianceStatus;
  rating: number;
  totalRides: number;
  joinedAt: string;
  verifiedBadge: boolean;
}

export interface StateRegulations {
  state: string;
  city: string;
  minAge: number;
  minDrivingYearsRequired: number;
  minVehicleYear: number;
  maxVehicleYear: number;
  allowedVehicleTypes: VehicleType[];
  requiredDocuments: DocumentType[];
  backgroundCheckRequired: boolean;
  backgroundCheckDaysValid: number;
  chauffeurLicenseRequired: boolean;
  liveryCardRequired: boolean;
  commercialInsuranceRequired: boolean;
  minInsuranceLiability: number; // in dollars
  maxVehicleAge: number; // in years
  tnpRules: string;
  basePrice: number; // in dollars
  perMilePrice: number; // in dollars
  minFare: number; // in dollars
  surgePricing: boolean;
  maxSurgeMultiplier: number;
}

// Top 15-20 US rideshare cities with regulations
export const STATE_REGULATIONS: StateRegulations[] = [
  {
    state: 'Illinois',
    city: 'Chicago',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['chauffeur-license', 'driver-license', 'livery-card', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: true,
    liveryCardRequired: true,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Illinois TNP regulations require chauffeur license, livery card, and commercial insurance for Black Car service.',
    basePrice: 8.0,
    perMilePrice: 2.5,
    minFare: 15.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'New York',
    city: 'New York',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2015,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1500000,
    maxVehicleAge: 11,
    tnpRules: 'NYC TLC regulations for Black Car service. Commercial insurance required.',
    basePrice: 10.0,
    perMilePrice: 2.75,
    minFare: 18.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.5,
  },
  {
    state: 'California',
    city: 'San Francisco',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'California TNP regulations for premium rideshare service.',
    basePrice: 9.0,
    perMilePrice: 2.6,
    minFare: 16.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'California',
    city: 'Los Angeles',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'California TNP regulations for premium rideshare service.',
    basePrice: 8.5,
    perMilePrice: 2.4,
    minFare: 15.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Massachusetts',
    city: 'Boston',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Massachusetts TNP regulations for premium rideshare service.',
    basePrice: 9.5,
    perMilePrice: 2.7,
    minFare: 17.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'District of Columbia',
    city: 'Washington DC',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'DC TNP regulations for premium rideshare service.',
    basePrice: 9.0,
    perMilePrice: 2.6,
    minFare: 16.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Florida',
    city: 'Miami',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Florida TNP regulations for premium rideshare service.',
    basePrice: 8.0,
    perMilePrice: 2.3,
    minFare: 14.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Texas',
    city: 'Austin',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Texas TNP regulations for premium rideshare service.',
    basePrice: 7.5,
    perMilePrice: 2.2,
    minFare: 13.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Colorado',
    city: 'Denver',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Colorado TNP regulations for premium rideshare service.',
    basePrice: 8.0,
    perMilePrice: 2.4,
    minFare: 15.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Washington',
    city: 'Seattle',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Washington TNP regulations for premium rideshare service.',
    basePrice: 9.0,
    perMilePrice: 2.5,
    minFare: 16.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Arizona',
    city: 'Phoenix',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Arizona TNP regulations for premium rideshare service.',
    basePrice: 7.5,
    perMilePrice: 2.2,
    minFare: 13.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Texas',
    city: 'Dallas',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Texas TNP regulations for premium rideshare service.',
    basePrice: 7.5,
    perMilePrice: 2.2,
    minFare: 13.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Texas',
    city: 'Houston',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Texas TNP regulations for premium rideshare service.',
    basePrice: 7.5,
    perMilePrice: 2.2,
    minFare: 13.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Georgia',
    city: 'Atlanta',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Georgia TNP regulations for premium rideshare service.',
    basePrice: 7.5,
    perMilePrice: 2.2,
    minFare: 13.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'Pennsylvania',
    city: 'Philadelphia',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'Pennsylvania TNP regulations for premium rideshare service.',
    basePrice: 8.5,
    perMilePrice: 2.4,
    minFare: 15.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
  {
    state: 'California',
    city: 'San Diego',
    minAge: 21,
    minDrivingYearsRequired: 3,
    minVehicleYear: 2016,
    maxVehicleYear: 2026,
    allowedVehicleTypes: ['black-car', 'black-suv'],
    requiredDocuments: ['driver-license', 'background-check', 'insurance', 'profile-picture'],
    backgroundCheckRequired: true,
    backgroundCheckDaysValid: 365,
    chauffeurLicenseRequired: false,
    liveryCardRequired: false,
    commercialInsuranceRequired: true,
    minInsuranceLiability: 1000000,
    maxVehicleAge: 10,
    tnpRules: 'California TNP regulations for premium rideshare service.',
    basePrice: 8.5,
    perMilePrice: 2.4,
    minFare: 15.0,
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
  },
];

/**
 * Get regulations for a specific city/state
 */
export function getRegulations(state: string, city: string): StateRegulations | null {
  return STATE_REGULATIONS.find(r => r.state === state && r.city === city) || null;
}

/**
 * Get all available cities for a state
 */
export function getCitiesByState(state: string): string[] {
  return [...new Set(STATE_REGULATIONS.filter(r => r.state === state).map(r => r.city))];
}

/**
 * Get all available states
 */
export function getAvailableStates(): string[] {
  return [...new Set(STATE_REGULATIONS.map(r => r.state))];
}

/**
 * Calculate Black Car fare with surge
 */
export function calculateBlackCarFare(
  regulations: StateRegulations,
  distanceMiles: number,
  surgeMultiplier: number = 1.0
): number {
  const baseFare = regulations.basePrice;
  const distanceFare = distanceMiles * regulations.perMilePrice;
  const subtotal = baseFare + distanceFare;
  const withSurge = subtotal * surgeMultiplier;
  return Math.max(withSurge, regulations.minFare);
}

/**
 * Check if driver meets age requirement
 */
export function meetsAgeRequirement(dateOfBirth: string, minAge: number): boolean {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= minAge;
}

/**
 * Check if vehicle meets year requirement
 */
export function meetsVehicleYearRequirement(vehicleYear: number, minYear: number, maxYear: number): boolean {
  return vehicleYear >= minYear && vehicleYear <= maxYear;
}

/**
 * Check if all required documents are uploaded
 */
export function hasAllRequiredDocuments(driver: ProfessionalDriver, regulations: StateRegulations): boolean {
  const uploadedDocTypes = driver.documents.map(d => d.type);
  return regulations.requiredDocuments.every(docType => uploadedDocTypes.includes(docType));
}

/**
 * Check if driver is fully compliant
 */
export function isFullyCompliant(driver: ProfessionalDriver, regulations: StateRegulations): boolean {
  return (
    driver.overallStatus === 'approved' &&
    hasAllRequiredDocuments(driver, regulations) &&
    driver.vehicles.length > 0 &&
    driver.vehicles.every(v => v.status === 'approved')
  );
}
