    rideType: 'Rydinex XL',
  },
];

export const MOCK_RIDE_REQUEST: RideRequest = {
  id: 'req1',
  riderId: 'rider1',
  riderName: 'Alex Thompson',
  pickup: { latitude: 37.7849, longitude: -122.4094, address: '123 Main St, SF' },
  dropoff: { latitude: 37.7935, longitude: -122.3951, address: '1 Market St, SF' },
  fare: 14.50,
  distance: '2.3 mi',
  duration: '12 min',
};

export function calculateFare(distanceMiles: number, rideType: RideType): number {
  const BASE_FARE = 2.50;
  const COST_PER_MILE = 1.75;
  const COST_PER_MIN = 0.35;
  const AVG_SPEED_MPH = 20;