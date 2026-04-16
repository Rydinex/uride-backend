import { describe, it, expect } from 'vitest';
import { calculateFare, getDistanceBetween } from '../lib/mock-data';

describe('Fare Calculation', () => {
  it('calculates base fare for Rydinex', () => {
    const fare = calculateFare(3.0, 'Rydinex');
    expect(fare).toBeGreaterThan(2.50); // at least base fare
    expect(fare).toBeLessThan(20);
  });

  it('Rydinex XL costs more than Rydinex for same distance', () => {
    const fareX = calculateFare(3.0, 'Rydinex');
    const fareXL = calculateFare(3.0, 'Rydinex XL');
    expect(fareXL).toBeGreaterThan(fareX);
  });

  it('Black is most expensive', () => {
    const fareX = calculateFare(3.0, 'Rydinex');
    const fareBlack = calculateFare(3.0, 'Black');
    expect(fareBlack).toBeGreaterThan(fareX);
  });

  it('longer distance = higher fare', () => {
    const shortFare = calculateFare(1.0, 'Rydinex');
    const longFare = calculateFare(10.0, 'Rydinex');
    expect(longFare).toBeGreaterThan(shortFare);
  });
});

describe('Distance Calculation', () => {
  it('distance between same points is 0', () => {
    const d = getDistanceBetween(37.7849, -122.4094, 37.7849, -122.4094);
    expect(d).toBeCloseTo(0, 5);
  });

  it('SF to SFO is approximately 13 miles', () => {
    const d = getDistanceBetween(37.7849, -122.4094, 37.6213, -122.3790);
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(20);
  });

  it('distance is symmetric', () => {
    const d1 = getDistanceBetween(37.7849, -122.4094, 37.6213, -122.3790);
    const d2 = getDistanceBetween(37.6213, -122.3790, 37.7849, -122.4094);
    expect(d1).toBeCloseTo(d2, 5);
  });
});

describe('App State Shape', () => {
  it('mock ride request has required fields', async () => {
    const { MOCK_RIDE_REQUEST } = await import('../lib/mock-data');
    expect(MOCK_RIDE_REQUEST).toHaveProperty('id');
    expect(MOCK_RIDE_REQUEST).toHaveProperty('riderName');
    expect(MOCK_RIDE_REQUEST).toHaveProperty('pickup');
    expect(MOCK_RIDE_REQUEST).toHaveProperty('dropoff');
    expect(MOCK_RIDE_REQUEST).toHaveProperty('fare');
    expect(MOCK_RIDE_REQUEST.fare).toBeGreaterThan(0);
  });

  it('payment methods have required fields', async () => {
    const { PAYMENT_METHODS } = await import('../lib/mock-data');
    expect(PAYMENT_METHODS.length).toBeGreaterThan(0);
    PAYMENT_METHODS.forEach(pm => {
      expect(pm).toHaveProperty('id');
      expect(pm).toHaveProperty('type');
      expect(pm).toHaveProperty('label');
    });
  });

  it('ride types have correct multipliers', async () => {
    const { RIDE_TYPES } = await import('../lib/mock-data');
    const rydinex = RIDE_TYPES.find(r => r.type === 'Rydinex');
    const black = RIDE_TYPES.find(r => r.type === 'Black');
    expect(rydinex?.multiplier).toBe(1.0);
    expect(black?.multiplier).toBe(2.5);
  });
});
