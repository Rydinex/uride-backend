/**
 * Surge Pricing Service
 * Handles surge zones, multipliers, heat map data, and earnings calculations
 */

export interface SurgeZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  multiplier: number; // 1.0 = no surge, 2.5 = 250% surge
  demand: 'low' | 'medium' | 'high' | 'extreme';
  driversAvailable: number;
  requestsWaiting: number;
  color: string; // hex color for map visualization
}

export interface SurgeHistory {
  zoneId: string;
  date: string; // YYYY-MM-DD
  hourlyData: {
    hour: number; // 0-23
    multiplier: number;
    demand: string;
    driversAvailable: number;
    requestsWaiting: number;
  }[];
}

export interface DriverEarningsProjection {
  zoneId: string;
  zoneName: string;
  multiplier: number;
  estimatedEarningsPerHour: number;
  estimatedTripsPerHour: number;
  recommendation: string;
}

// Mock surge zones across San Francisco
export const MOCK_SURGE_ZONES: SurgeZone[] = [
  {
    id: 'downtown',
    name: 'Downtown SF',
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 1500,
    multiplier: 2.5,
    demand: 'extreme',
    driversAvailable: 8,
    requestsWaiting: 24,
    color: '#FF4444', // Red
  },
  {
    id: 'financial',
    name: 'Financial District',
    latitude: 37.7933,
    longitude: -122.3951,
    radius: 1200,
    multiplier: 2.0,
    demand: 'high',
    driversAvailable: 12,
    requestsWaiting: 18,
    color: '#FF8800', // Orange
  },
  {
    id: 'mission',
    name: 'Mission District',
    latitude: 37.7599,
    longitude: -122.4148,
    radius: 1400,
    multiplier: 1.5,
    demand: 'high',
    driversAvailable: 15,
    requestsWaiting: 16,
    color: '#FFCC00', // Yellow
  },
  {
    id: 'marina',
    name: 'Marina District',
    latitude: 37.8044,
    longitude: -122.4383,
    radius: 1300,
    multiplier: 1.2,
    demand: 'medium',
    driversAvailable: 20,
    requestsWaiting: 8,
    color: '#88DD44', // Light Green
  },
  {
    id: 'sunset',
    name: 'Sunset District',
    latitude: 37.7597,
    longitude: -122.4567,
    radius: 1600,
    multiplier: 1.0,
    demand: 'low',
    driversAvailable: 25,
    requestsWaiting: 2,
    color: '#44DD88', // Green
  },
  {
    id: 'castro',
    name: 'Castro District',
    latitude: 37.7599,
    longitude: -122.4348,
    radius: 1200,
    multiplier: 1.8,
    demand: 'high',
    driversAvailable: 10,
    requestsWaiting: 14,
    color: '#FF9944', // Orange
  },
  {
    id: 'haight',
    name: 'Haight-Ashbury',
    latitude: 37.7694,
    longitude: -122.4862,
    radius: 1100,
    multiplier: 1.3,
    demand: 'medium',
    driversAvailable: 18,
    requestsWaiting: 6,
    color: '#FFDD44', // Yellow
  },
  {
    id: 'soma',
    name: 'SOMA',
    latitude: 37.7749,
    longitude: -122.3949,
    radius: 1500,
    multiplier: 2.2,
    demand: 'high',
    driversAvailable: 11,
    requestsWaiting: 20,
    color: '#FF7744', // Orange-Red
  },
];

// Mock surge history for today
export const MOCK_SURGE_HISTORY: SurgeHistory = {
  zoneId: 'downtown',
  date: new Date().toISOString().split('T')[0],
  hourlyData: [
    { hour: 6, multiplier: 1.0, demand: 'low', driversAvailable: 30, requestsWaiting: 2 },
    { hour: 7, multiplier: 1.2, demand: 'medium', driversAvailable: 25, requestsWaiting: 8 },
    { hour: 8, multiplier: 1.8, demand: 'high', driversAvailable: 15, requestsWaiting: 18 },
    { hour: 9, multiplier: 2.5, demand: 'extreme', driversAvailable: 8, requestsWaiting: 24 },
    { hour: 10, multiplier: 2.8, demand: 'extreme', driversAvailable: 6, requestsWaiting: 28 },
    { hour: 11, multiplier: 2.2, demand: 'high', driversAvailable: 12, requestsWaiting: 16 },
    { hour: 12, multiplier: 1.5, demand: 'medium', driversAvailable: 18, requestsWaiting: 10 },
    { hour: 13, multiplier: 1.3, demand: 'medium', driversAvailable: 20, requestsWaiting: 6 },
    { hour: 14, multiplier: 1.1, demand: 'low', driversAvailable: 28, requestsWaiting: 3 },
    { hour: 15, multiplier: 1.4, demand: 'medium', driversAvailable: 19, requestsWaiting: 8 },
    { hour: 16, multiplier: 1.9, demand: 'high', driversAvailable: 13, requestsWaiting: 17 },
    { hour: 17, multiplier: 2.6, demand: 'extreme', driversAvailable: 7, requestsWaiting: 26 },
    { hour: 18, multiplier: 2.4, demand: 'high', driversAvailable: 9, requestsWaiting: 22 },
    { hour: 19, multiplier: 2.0, demand: 'high', driversAvailable: 14, requestsWaiting: 15 },
    { hour: 20, multiplier: 1.6, demand: 'medium', driversAvailable: 17, requestsWaiting: 9 },
  ],
};

/**
 * Get surge zone at a specific location
 */
export function getSurgeZoneAtLocation(latitude: number, longitude: number): SurgeZone | null {
  for (const zone of MOCK_SURGE_ZONES) {
    const distance = getDistanceBetween(latitude, longitude, zone.latitude, zone.longitude);
    if (distance * 1000 <= zone.radius) {
      return zone;
    }
  }
  return null;
}

/**
 * Calculate distance between two coordinates in km
 */
export function getDistanceBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get all surge zones with their current status
 */
export function getAllSurgeZones(): SurgeZone[] {
  return MOCK_SURGE_ZONES;
}

/**
 * Get heat map data for visualization
 */
export function getHeatMapData(): Array<{ latitude: number; longitude: number; weight: number }> {
  return MOCK_SURGE_ZONES.map(zone => ({
    latitude: zone.latitude,
    longitude: zone.longitude,
    weight: zone.multiplier, // Higher multiplier = more intense heat
  }));
}

/**
 * Calculate driver earnings projection for a zone
 */
export function calculateDriverEarningsProjection(zone: SurgeZone): DriverEarningsProjection {
  const BASE_FARE = 2.5;
  const COST_PER_MILE = 1.75;
  const AVG_TRIP_DISTANCE = 3.5; // miles
  const AVG_TRIPS_PER_HOUR = 2.5;

  const baseFare = BASE_FARE + (AVG_TRIP_DISTANCE * COST_PER_MILE);
  const surgedFare = baseFare * zone.multiplier;
  const estimatedEarningsPerHour = surgedFare * AVG_TRIPS_PER_HOUR;

  let recommendation = 'Normal demand';
  if (zone.multiplier >= 2.5) {
    recommendation = '🔥 Extreme surge! High earnings potential';
  } else if (zone.multiplier >= 2.0) {
    recommendation = '⬆️ High surge - Great time to drive';
  } else if (zone.multiplier >= 1.5) {
    recommendation = '📈 Moderate surge - Good earnings';
  }

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    multiplier: zone.multiplier,
    estimatedEarningsPerHour: Math.round(estimatedEarningsPerHour * 100) / 100,
    estimatedTripsPerHour: Math.round(AVG_TRIPS_PER_HOUR * 10) / 10,
    recommendation,
  };
}

/**
 * Get top surge zones for drivers to navigate to
 */
export function getTopSurgeZones(limit: number = 3): SurgeZone[] {
  return [...MOCK_SURGE_ZONES].sort((a, b) => b.multiplier - a.multiplier).slice(0, limit);
}

/**
 * Get surge color based on multiplier
 */
export function getSurgeColor(multiplier: number): string {
  if (multiplier >= 2.5) return '#FF4444'; // Red
  if (multiplier >= 2.0) return '#FF8800'; // Orange
  if (multiplier >= 1.5) return '#FFCC00'; // Yellow
  if (multiplier >= 1.2) return '#FFDD44'; // Light Yellow
  return '#44DD88'; // Green
}

/**
 * Get demand level text
 */
export function getDemandText(demand: string): string {
  const demandMap: Record<string, string> = {
    low: '🟢 Low Demand',
    medium: '🟡 Medium Demand',
    high: '🟠 High Demand',
    extreme: '🔴 Extreme Demand',
  };
  return demandMap[demand] || 'Unknown';
}

/**
 * Simulate real-time surge updates (for demo purposes)
 */
export function simulateSurgeUpdate(): SurgeZone[] {
  return MOCK_SURGE_ZONES.map(zone => ({
    ...zone,
    multiplier: Math.max(1.0, zone.multiplier + (Math.random() - 0.5) * 0.3),
    driversAvailable: Math.max(1, zone.driversAvailable + Math.floor((Math.random() - 0.5) * 4)),
    requestsWaiting: Math.max(0, zone.requestsWaiting + Math.floor((Math.random() - 0.5) * 6)),
  }));
}
