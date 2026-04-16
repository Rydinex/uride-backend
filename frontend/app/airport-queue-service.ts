/**
 * Airport Queue Service
 * Handles geofencing, queue management, flight integration, and metrics
 */

export interface Airport {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number; // in meters
  timezone: string;
}

export interface QueuePosition {
  driverId: string;
  position: number; // 1-based position in queue
  arrivalTime: number; // timestamp when driver arrived at queue
  estimatedWaitMinutes: number;
  status: 'waiting' | 'next' | 'pickup_assigned' | 'completed';
}

export interface Flight {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledArrival: number; // timestamp
  estimatedArrival: number; // timestamp
  actualArrival?: number; // timestamp
  gate?: string;
  status: 'scheduled' | 'boarding' | 'departed' | 'in_flight' | 'landed' | 'arrived';
  terminal?: string;
  baggage?: string;
}

export interface AirportQueue {
  airportId: string;
  totalCarsWaiting: number;
  averageWaitMinutes: number;
  positions: QueuePosition[];
  lastUpdated: number;
}

export interface QueueMetrics {
  airportId: string;
  date: string; // YYYY-MM-DD
  hourlyData: {
    hour: number; // 0-23
    carsInQueue: number;
    averageWaitMinutes: number;
    pickupsCompleted: number;
  }[];
  peakHour: number;
  peakQueueLength: number;
  totalPickupsCompleted: number;
}

// Mock airports
export const MOCK_AIRPORTS: Airport[] = [
  {
    id: 'sfo',
    name: 'San Francisco International',
    code: 'SFO',
    latitude: 37.6213,
    longitude: -122.3790,
    geofenceRadius: 2000, // 2km
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'oak',
    name: 'Oakland International',
    code: 'OAK',
    latitude: 37.7213,
    longitude: -122.2208,
    geofenceRadius: 1500,
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'sjc',
    name: 'San José Mineta International',
    code: 'SJC',
    latitude: 37.3639,
    longitude: -121.9289,
    geofenceRadius: 1500,
    timezone: 'America/Los_Angeles',
  },
];

// Mock flights
export const MOCK_FLIGHTS: Flight[] = [
  {
    id: 'f1',
    flightNumber: 'UA456',
    airline: 'United Airlines',
    airlineCode: 'UA',
    departureAirport: 'LAX',
    arrivalAirport: 'SFO',
    scheduledArrival: Date.now() + 45 * 60000, // 45 min from now
    estimatedArrival: Date.now() + 42 * 60000,
    gate: 'G12',
    status: 'in_flight',
    terminal: '3',
  },
  {
    id: 'f2',
    flightNumber: 'AA789',
    airline: 'American Airlines',
    airlineCode: 'AA',
    departureAirport: 'JFK',
    arrivalAirport: 'SFO',
    scheduledArrival: Date.now() + 180 * 60000, // 3 hours
    estimatedArrival: Date.now() + 175 * 60000,
    status: 'in_flight',
    terminal: '1',
  },
  {
    id: 'f3',
    flightNumber: 'DL234',
    airline: 'Delta Airlines',
    airlineCode: 'DL',
    departureAirport: 'ATL',
    arrivalAirport: 'SFO',
    scheduledArrival: Date.now() + 300 * 60000, // 5 hours
    estimatedArrival: Date.now() + 295 * 60000,
    status: 'scheduled',
    terminal: '2',
  },
  {
    id: 'f4',
    flightNumber: 'SW567',
    airline: 'Southwest Airlines',
    airlineCode: 'SW',
    departureAirport: 'LAS',
    arrivalAirport: 'SFO',
    scheduledArrival: Date.now() + 15 * 60000, // 15 min
    estimatedArrival: Date.now() + 12 * 60000,
    gate: 'C5',
    status: 'landed',
    terminal: '3',
    baggage: '12',
  },
];

// Mock queue data
export const MOCK_QUEUE_DATA: AirportQueue = {
  airportId: 'sfo',
  totalCarsWaiting: 12,
  averageWaitMinutes: 8,
  positions: [
    { driverId: 'd1', position: 1, arrivalTime: Date.now() - 5 * 60000, estimatedWaitMinutes: 2, status: 'next' },
    { driverId: 'd2', position: 2, arrivalTime: Date.now() - 3 * 60000, estimatedWaitMinutes: 5, status: 'waiting' },
    { driverId: 'd3', position: 3, arrivalTime: Date.now() - 2 * 60000, estimatedWaitMinutes: 8, status: 'waiting' },
    { driverId: 'd4', position: 4, arrivalTime: Date.now() - 1 * 60000, estimatedWaitMinutes: 11, status: 'waiting' },
    { driverId: 'd5', position: 5, arrivalTime: Date.now(), estimatedWaitMinutes: 14, status: 'waiting' },
  ],
  lastUpdated: Date.now(),
};

// Mock hourly metrics for today
export const MOCK_QUEUE_METRICS: QueueMetrics = {
  airportId: 'sfo',
  date: new Date().toISOString().split('T')[0],
  hourlyData: [
    { hour: 6, carsInQueue: 2, averageWaitMinutes: 3, pickupsCompleted: 4 },
    { hour: 7, carsInQueue: 5, averageWaitMinutes: 5, pickupsCompleted: 8 },
    { hour: 8, carsInQueue: 18, averageWaitMinutes: 12, pickupsCompleted: 15 },
    { hour: 9, carsInQueue: 24, averageWaitMinutes: 18, pickupsCompleted: 20 },
    { hour: 10, carsInQueue: 28, averageWaitMinutes: 22, pickupsCompleted: 18 },
    { hour: 11, carsInQueue: 22, averageWaitMinutes: 16, pickupsCompleted: 22 },
    { hour: 12, carsInQueue: 15, averageWaitMinutes: 10, pickupsCompleted: 25 },
    { hour: 13, carsInQueue: 12, averageWaitMinutes: 8, pickupsCompleted: 20 },
    { hour: 14, carsInQueue: 8, averageWaitMinutes: 5, pickupsCompleted: 18 },
    { hour: 15, carsInQueue: 6, averageWaitMinutes: 4, pickupsCompleted: 15 },
  ],
  peakHour: 10,
  peakQueueLength: 28,
  totalPickupsCompleted: 165,
};

/**
 * Check if a location is within airport geofence
 */
export function isInAirportGeofence(
  latitude: number,
  longitude: number,
  airport: Airport
): boolean {
  const R = 6371000; // Earth radius in meters
  const dLat = (airport.latitude - latitude) * Math.PI / 180;
  const dLon = (airport.longitude - longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(latitude * Math.PI / 180) * Math.cos(airport.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance <= airport.geofenceRadius;
}

/**
 * Find nearest airport to a location
 */
export function findNearestAirport(latitude: number, longitude: number): Airport | null {
  let nearest: Airport | null = null;
  let minDistance = Infinity;

  for (const airport of MOCK_AIRPORTS) {
    const R = 6371; // Earth radius in km
    const dLat = (airport.latitude - latitude) * Math.PI / 180;
    const dLon = (airport.longitude - longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(latitude * Math.PI / 180) * Math.cos(airport.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < minDistance) {
      minDistance = distance;
      nearest = airport;
    }
  }

  return nearest;
}

/**
 * Get flight status text
 */
export function getFlightStatusText(flight: Flight): string {
  const statusMap: Record<Flight['status'], string> = {
    scheduled: 'Scheduled',
    boarding: 'Boarding',
    departed: 'Departed',
    in_flight: 'In Flight',
    landed: 'Landed',
    arrived: 'Arrived',
  };
  return statusMap[flight.status] || 'Unknown';
}

/**
 * Get time until flight arrival in minutes
 */
export function getMinutesUntilArrival(flight: Flight): number {
  const now = Date.now();
  const arrivalTime = flight.estimatedArrival || flight.scheduledArrival;
  return Math.max(0, Math.round((arrivalTime - now) / 60000));
}

/**
 * Format flight info for display
 */
export function formatFlightInfo(flight: Flight): string {
  const minutesUntil = getMinutesUntilArrival(flight);
  if (minutesUntil === 0) return 'Arriving now';
  if (minutesUntil < 60) return `Arriving in ${minutesUntil} min`;
  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  return `Arriving in ${hours}h ${mins}m`;
}

/**
 * Get queue wait time for a driver at position
 */
export function getWaitTimeForPosition(position: number): number {
  // Assume 3 minutes per car in queue
  const MINUTES_PER_CAR = 3;
  return (position - 1) * MINUTES_PER_CAR;
}

/**
 * Search flights by flight number
 */
export function searchFlightByNumber(flightNumber: string): Flight | null {
  const normalized = flightNumber.toUpperCase().trim();
  return MOCK_FLIGHTS.find(f => f.flightNumber.toUpperCase() === normalized) || null;
}
