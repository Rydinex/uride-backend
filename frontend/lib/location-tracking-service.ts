// Location Tracking Service for Real-Time Rider-Driver Tracking

export interface LocationPin {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  type: 'pickup' | 'dropoff';
  timestamp: number;
}

export interface LiveLocation {
  userId: string;
  userType: 'rider' | 'driver';
  latitude: number;
  longitude: number;
  bearing: number; // Direction in degrees (0-360)
  speed: number; // Speed in m/s
  accuracy: number; // Accuracy in meters
  timestamp: number;
}

export interface TrackingMetrics {
  distanceToPickup: number; // in miles
  distanceToDropoff: number; // in miles
  etaToPickup: number; // in seconds
  etaToDropoff: number; // in seconds
  currentSpeed: number; // in mph
  bearing: number; // Direction
}

// Haversine formula to calculate distance between two coordinates
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing (direction) between two points
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

// Estimate ETA based on distance and average speed
export function calculateETA(distanceMiles: number, averageSpeedMph: number = 25): number {
  if (averageSpeedMph === 0) return 0;
  const hours = distanceMiles / averageSpeedMph;
  return Math.round(hours * 3600); // Return in seconds
}

// Mock location update generator for simulation
export function generateMockLocationUpdate(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  speed: number = 30 // mph
): LiveLocation {
  const bearing = calculateBearing(currentLat, currentLon, targetLat, targetLon);
  const distance = calculateDistance(currentLat, currentLon, targetLat, targetLon);

  // Move towards target
  const moveDistance = (speed * 0.277778) / 3600; // Convert mph to miles per second, then to miles per update
  const moveRatio = Math.min(moveDistance / distance, 1);

  const newLat = currentLat + (targetLat - currentLat) * moveRatio;
  const newLon = currentLon + (targetLon - currentLon) * moveRatio;

  return {
    userId: 'user-' + Math.random().toString(36).substr(2, 9),
    userType: 'driver',
    latitude: newLat,
    longitude: newLon,
    bearing: bearing,
    speed: speed,
    accuracy: 5,
    timestamp: Date.now(),
  };
}

// Calculate tracking metrics between two locations
export function calculateTrackingMetrics(
  driverLat: number,
  driverLon: number,
  riderLat: number,
  riderLon: number,
  pickupLat: number,
  pickupLon: number,
  dropoffLat: number,
  dropoffLon: number,
  driverSpeed: number = 25
): TrackingMetrics {
  const distanceToPickup = calculateDistance(driverLat, driverLon, pickupLat, pickupLon);
  const distanceToDropoff = calculateDistance(pickupLat, pickupLon, dropoffLat, dropoffLon);
  const bearing = calculateBearing(driverLat, driverLon, pickupLat, pickupLon);

  return {
    distanceToPickup,
    distanceToDropoff,
    etaToPickup: calculateETA(distanceToPickup, driverSpeed),
    etaToDropoff: calculateETA(distanceToPickup + distanceToDropoff, driverSpeed),
    currentSpeed: driverSpeed,
    bearing,
  };
}

// Format distance for display
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return Math.round(miles * 5280) + ' ft';
  }
  return miles.toFixed(1) + ' mi';
}

// Format ETA for display
export function formatETA(seconds: number): string {
  if (seconds < 60) {
    return Math.round(seconds) + ' sec';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return minutes + ' min';
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours + 'h ' + mins + 'm';
}

// Mock location data for testing
export const MOCK_LOCATIONS = {
  sanFrancisco: { latitude: 37.7749, longitude: -122.4194 },
  pickupLocation: { latitude: 37.7849, longitude: -122.4094 },
  dropoffLocation: { latitude: 37.7649, longitude: -122.4294 },
  driverStartLocation: { latitude: 37.7749, longitude: -122.4194 },
};

// Animate location smoothly between two points
export function interpolateLocation(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  progress: number // 0 to 1
): { latitude: number; longitude: number } {
  return {
    latitude: startLat + (endLat - startLat) * progress,
    longitude: startLon + (endLon - startLon) * progress,
  };
}
