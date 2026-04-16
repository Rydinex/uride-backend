/**
 * Standard Driver Service
 * Manages Rydinex standard drivers with three service tiers and payout calculations
 */

export type StandardDriverTier = 'rydinex' | 'comfort' | 'xl';
export type DocumentType = 'driver-license' | 'insurance' | 'background-check' | 'profile-photo' | 'car-inspection' | 'drug-test';
export type ComplianceStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'under-review';

export interface StandardDocument {
  id: string;
  type: DocumentType;
  status: ComplianceStatus;
  uploadedAt: string;
  expiresAt: string | null;
  verifiedAt: string | null;
  notes: string;
}

export interface StandardVehicle {
  id: string;
  tier: StandardDriverTier;
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
  inspectionExpiresAt: string;
  photos: string[];
  registeredAt: string;
  status: ComplianceStatus;
}

export interface StandardDriver {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ssn: string; // Last 4 digits only
  dateOfBirth: string;
  address: string;
  profilePicture: string;
  tier: StandardDriverTier;
  documents: StandardDocument[];
  vehicles: StandardVehicle[];
  backgroundCheckStatus: ComplianceStatus;
  backgroundCheckDate: string | null;
  drugTestStatus: ComplianceStatus;
  drugTestDate: string | null;
  overallStatus: ComplianceStatus;
  rating: number;
  totalRides: number;
  totalEarnings: number;
  joinedAt: string;
  verifiedBadge: boolean;
}

export interface TierPricing {
  tier: StandardDriverTier;
  displayName: string;
  emoji: string;
  baseFare: number; // in dollars
  perMileFare: number; // in dollars
  perMinuteFare: number; // in dollars
  minFare: number; // in dollars
  description: string;
  vehicleTypes: string[];
  maxPassengers: number;
}

export interface PayoutCalculation {
  rideFare: number;
  creditCardFee: number; // 2.9% + $0.30
  cityFee: number; // 5%
  subtotalFees: number;
  driverPayout: number; // 70% of (rideFare - fees)
  rydinexRevenue: number; // 30% of (rideFare - fees)
}

// Standard Driver Requirements (Nationwide)
export const STANDARD_DRIVER_REQUIREMENTS = {
  minAge: 18,
  minDrivingYearsRequired: 1,
  minVehicleYear: 2016,
  maxVehicleYear: 2026,
  requiredDocuments: ['driver-license', 'insurance', 'background-check', 'profile-photo', 'car-inspection', 'drug-test'] as DocumentType[],
  backgroundCheckRequired: true,
  backgroundCheckDaysValid: 365,
  drugTestRequired: true,
  drugTestDaysValid: 365,
  carInspectionRequired: true,
  carInspectionDaysValid: 365,
  maxVehicleAge: 10,
  description: 'Standard nationwide requirements for all Rydinex drivers',
};

// Tier Pricing Configuration
export const TIER_PRICING: Record<StandardDriverTier, TierPricing> = {
  rydinex: {
    tier: 'rydinex',
    displayName: 'Rydinex',
    emoji: '🚗',
    baseFare: 3.0,
    perMileFare: 1.5,
    perMinuteFare: 0.25,
    minFare: 5.0,
    description: 'Affordable rides in economy cars',
    vehicleTypes: ['Sedan', 'Compact', 'Hatchback'],
    maxPassengers: 4,
  },
  comfort: {
    tier: 'comfort',
    displayName: 'Rydinex Comfort',
    emoji: '🚙',
    baseFare: 4.5,
    perMileFare: 2.0,
    perMinuteFare: 0.35,
    minFare: 7.5,
    description: 'Comfortable rides in mid-range cars',
    vehicleTypes: ['Sedan', 'Crossover', 'Wagon'],
    maxPassengers: 5,
  },
  xl: {
    tier: 'xl',
    displayName: 'Rydinex XL',
    emoji: '🚐',
    baseFare: 6.0,
    perMileFare: 2.5,
    perMinuteFare: 0.45,
    minFare: 10.0,
    description: 'Spacious rides for groups or luggage',
    vehicleTypes: ['SUV', 'Minivan', 'Large Crossover'],
    maxPassengers: 6,
  },
};

/**
 * Calculate ride fare for a standard driver tier
 */
export function calculateStandardFare(
  tier: StandardDriverTier,
  distanceMiles: number,
  durationMinutes: number,
  surgeMultiplier: number = 1.0
): number {
  const pricing = TIER_PRICING[tier];
  const baseFare = pricing.baseFare;
  const distanceFare = distanceMiles * pricing.perMileFare;
  const timeFare = durationMinutes * pricing.perMinuteFare;
  const subtotal = baseFare + distanceFare + timeFare;
  const withSurge = subtotal * surgeMultiplier;
  return Math.max(withSurge, pricing.minFare);
}

/**
 * Calculate driver payout (70% after fees)
 * Fees: Credit card 2.9% + $0.30, City fee 5%
 */
export function calculateDriverPayout(rideFare: number): PayoutCalculation {
  // Credit card fee: 2.9% + $0.30
  const creditCardFeePercent = rideFare * 0.029;
  const creditCardFee = creditCardFeePercent + 0.30;

  // City fee: 5%
  const cityFee = rideFare * 0.05;

  // Total fees
  const subtotalFees = creditCardFee + cityFee;

  // Amount available for payout
  const availableForPayout = rideFare - subtotalFees;

  // Driver gets 70%, Rydinex gets 30%
  const driverPayout = availableForPayout * 0.70;
  const rydinexRevenue = availableForPayout * 0.30;

  return {
    rideFare,
    creditCardFee,
    cityFee,
    subtotalFees,
    driverPayout: Math.round(driverPayout * 100) / 100,
    rydinexRevenue: Math.round(rydinexRevenue * 100) / 100,
  };
}

/**
 * Get tier pricing
 */
export function getTierPricing(tier: StandardDriverTier): TierPricing {
  return TIER_PRICING[tier];
}

/**
 * Get all available tiers
 */
export function getAvailableTiers(): StandardDriverTier[] {
  return ['rydinex', 'comfort', 'xl'];
}

/**
 * Check if driver meets age requirement
 */
export function meetsAgeRequirement(dateOfBirth: string, minAge: number = STANDARD_DRIVER_REQUIREMENTS.minAge): boolean {
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
export function meetsVehicleYearRequirement(
  vehicleYear: number,
  minYear: number = STANDARD_DRIVER_REQUIREMENTS.minVehicleYear,
  maxYear: number = STANDARD_DRIVER_REQUIREMENTS.maxVehicleYear
): boolean {
  return vehicleYear >= minYear && vehicleYear <= maxYear;
}

/**
 * Check if all required documents are uploaded
 */
export function hasAllRequiredDocuments(driver: StandardDriver): boolean {
  const uploadedDocTypes = driver.documents.map(d => d.type);
  return STANDARD_DRIVER_REQUIREMENTS.requiredDocuments.every(docType => uploadedDocTypes.includes(docType));
}

/**
 * Check if driver is fully compliant
 */
export function isFullyCompliant(driver: StandardDriver): boolean {
  return (
    driver.overallStatus === 'approved' &&
    hasAllRequiredDocuments(driver) &&
    driver.vehicles.length > 0 &&
    driver.vehicles.every(v => v.status === 'approved') &&
    driver.backgroundCheckStatus === 'approved' &&
    driver.drugTestStatus === 'approved'
  );
}

/**
 * Calculate total driver earnings for a period
 */
export function calculateTotalEarnings(rides: Array<{ fare: number }>): number {
  return rides.reduce((total, ride) => {
    const payout = calculateDriverPayout(ride.fare);
    return total + payout.driverPayout;
  }, 0);
}

/**
 * Format payout for display
 */
export function formatPayout(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get tier display info
 */
export function getTierDisplay(tier: StandardDriverTier) {
  const pricing = TIER_PRICING[tier];
  return {
    name: pricing.displayName,
    emoji: pricing.emoji,
    description: pricing.description,
    baseFare: pricing.baseFare,
    perMile: pricing.perMileFare,
  };
}
