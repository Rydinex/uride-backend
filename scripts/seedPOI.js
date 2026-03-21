/**
 * POI Database Seeding Script
 * Run: node backend/scripts/seedPOI.js
 * 
 * This seeds the database with sample POI data for testing
 */

const mongoose = require('mongoose');
const POI = require('../models/POI');
require('dotenv').config();

const samplePOIs = [
  // Restaurants
  {
    name: 'The Pasta House',
    category: 'restaurant',
    latitude: 40.758,
    longitude: -73.9855,
    address: '123 5th Ave, New York, NY',
    phoneNumber: '(212) 555-0123',
    rating: 4.7,
    reviewCount: 234,
    priceLevel: 2,
    aiTags: ['recommended', 'popular'],
    aiRelevanceScore: 85,
    tags: ['italian', 'outdoor_seating'],
    isOpen: true,
  },
  {
    name: 'Burger Palace',
    category: 'restaurant',
    latitude: 40.7489,
    longitude: -73.9680,
    address: '456 Park Ave, New York, NY',
    phoneNumber: '(212) 555-0456',
    rating: 4.3,
    reviewCount: 156,
    priceLevel: 1,
    aiTags: ['budget-friendly', 'popular'],
    aiRelevanceScore: 78,
    tags: ['burger', 'fast_food'],
    isOpen: true,
  },
  {
    name: 'Sushi Paradise',
    category: 'restaurant',
    latitude: 40.7614,
    longitude: -73.9776,
    address: '789 Madison Ave, New York, NY',
    phoneNumber: '(212) 555-0789',
    rating: 4.8,
    reviewCount: 312,
    priceLevel: 3,
    aiTags: ['recommended', 'premium'],
    aiRelevanceScore: 92,
    tags: ['japanese', 'premium'],
    isOpen: true,
  },

  // Gas Stations
  {
    name: 'Quick Fuel Station',
    category: 'gas_station',
    latitude: 40.7505,
    longitude: -73.9972,
    address: '321 W 42nd St, New York, NY',
    phoneNumber: '(212) 555-0321',
    rating: 4.1,
    reviewCount: 89,
    priceLevel: 2,
    aiTags: ['popular'],
    aiRelevanceScore: 75,
    tags: ['24-hour', 'convenience_store'],
    isOpen: true,
  },
  {
    name: 'Fuel Express',
    category: 'gas_station',
    latitude: 40.7549,
    longitude: -73.9840,
    address: '654 E 42nd St, New York, NY',
    phoneNumber: '(212) 555-0654',
    rating: 3.9,
    reviewCount: 67,
    priceLevel: 2,
    aiRelevanceScore: 70,
    tags: ['24-hour'],
    isOpen: true,
  },

  // Hospitals
  {
    name: 'Downtown Medical Center',
    category: 'hospital',
    latitude: 40.7614,
    longitude: -73.9963,
    address: '111 Medical Plaza, New York, NY',
    phoneNumber: '(212) 555-0111',
    rating: 4.5,
    reviewCount: 421,
    priceLevel: 2,
    aiTags: ['emergency', 'recommended'],
    aiRelevanceScore: 95,
    tags: ['24-hour', 'emergency', 'trauma_center'],
    isOpen: true,
  },
  {
    name: 'St. Health Hospital',
    category: 'hospital',
    latitude: 40.7489,
    longitude: -73.9680,
    address: '222 Hospital Ave, New York, NY',
    phoneNumber: '(212) 555-0222',
    rating: 4.3,
    reviewCount: 356,
    priceLevel: 2,
    aiTags: ['emergency'],
    aiRelevanceScore: 90,
    tags: ['24-hour', 'emergency'],
    isOpen: true,
  },

  // Hotels
  {
    name: 'Luxury Plaza Hotel',
    category: 'hotel',
    latitude: 40.7549,
    longitude: -73.9840,
    address: '789 Broadway, New York, NY',
    phoneNumber: '(212) 555-0789',
    rating: 4.9,
    reviewCount: 567,
    priceLevel: 4,
    aiTags: ['premium', 'recommended'],
    aiRelevanceScore: 88,
    tags: ['5-star', 'pool', 'restaurant'],
    isOpen: true,
  },
  {
    name: 'Budget Inn',
    category: 'hotel',
    latitude: 40.7580,
    longitude: -73.9855,
    address: '321 Park Ave, New York, NY',
    phoneNumber: '(212) 555-0321',
    rating: 3.8,
    reviewCount: 234,
    priceLevel: 1,
    aiTags: ['budget-friendly'],
    aiRelevanceScore: 65,
    tags: ['budget', 'basic'],
    isOpen: true,
  },

  // Pharmacies
  {
    name: 'Medicine Plus',
    category: 'pharmacy',
    latitude: 40.7614,
    longitude: -73.9776,
    address: '123 Health St, New York, NY',
    phoneNumber: '(212) 555-0123',
    rating: 4.4,
    reviewCount: 178,
    priceLevel: 2,
    aiRelevanceScore: 80,
    tags: ['24-hour', 'prescription'],
    isOpen: true,
  },

  // ATM
  {
    name: 'Bank ATM - Times Square',
    category: 'atm',
    latitude: 40.758,
    longitude: -73.9855,
    address: 'Times Square, New York, NY',
    rating: 4.0,
    reviewCount: 45,
    priceLevel: 1,
    aiRelevanceScore: 60,
    tags: ['24-hour', 'accessible'],
    isOpen: true,
  },

  // Cafes
  {
    name: 'Morning Brew Cafe',
    category: 'cafe',
    latitude: 40.7489,
    longitude: -73.9680,
    address: '456 Park Ave, New York, NY',
    phoneNumber: '(212) 555-0456',
    rating: 4.6,
    reviewCount: 289,
    priceLevel: 2,
    aiTags: ['recommended', 'popular'],
    aiRelevanceScore: 82,
    tags: ['wifi', 'outdoor_seating', 'pastries'],
    isOpen: true,
  },

  // EV Charging
  {
    name: 'Fast Charge Station',
    category: 'charging_station',
    latitude: 40.7505,
    longitude: -73.9972,
    address: '789 Electric Ave, New York, NY',
    phoneNumber: '(212) 555-0789',
    rating: 4.2,
    reviewCount: 134,
    priceLevel: 2,
    aiTags: ['new', 'popular'],
    aiRelevanceScore: 75,
    tags: ['tesla', 'fast_charging', '24-hour'],
    isOpen: true,
  },

  // Parking
  {
    name: 'Central Parking Garage',
    category: 'parking',
    latitude: 40.7549,
    longitude: -73.9840,
    address: '321 Park Row, New York, NY',
    phoneNumber: '(212) 555-0321',
    rating: 3.7,
    reviewCount: 123,
    priceLevel: 3,
    aiRelevanceScore: 70,
    tags: ['24-hour', 'secure'],
    isOpen: true,
  },
];

async function seedPOI() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing POI
    const deleted = await POI.deleteMany({});
    console.log(`🗑️  Deleted ${deleted.deletedCount} existing POI`);

    // Format POI with geospatial index
    const formattedPOIs = samplePOIs.map(poi => ({
      ...poi,
      location: {
        type: 'Point',
        coordinates: [poi.longitude, poi.latitude],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Insert sample POI
    const inserted = await POI.insertMany(formattedPOIs);
    console.log(`✅ Successfully seeded ${inserted.length} POI`);

    // Verify geospatial index
    const indexes = await POI.collection.getIndexes();
    console.log('📍 Database indexes:', Object.keys(indexes));

    console.log('\n🎉 POI database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding POI:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run seeding
seedPOI();
