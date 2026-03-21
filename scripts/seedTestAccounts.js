/**
 * Seed Script — Internal Testing Accounts
 *
 * Creates:
 *   Rider  — Marcus Rivera  <stylerspot@gmail.com>   password: Rydinex@2026
 *   Driver — Jordan Steele  <imiforever@gmail.com>   password: Rydinex@2026
 *
 * Run: node scripts/seedTestAccounts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Rider   = require('../models/Rider');
const Driver  = require('../models/Driver');
const Vehicle = require('../models/Vehicle');

const PASSWORD = 'Rydinex@2026';

// ─── Rider data ───────────────────────────────────────────────────────────────
const riderData = {
  name:  'Marcus Rivera',
  phone: '+13125550101',
  email: 'stylerspot@gmail.com',
};

// ─── Driver data ─────────────────────────────────────────────────────────────
const driverData = {
  name:  'Jordan Steele',
  phone: '+13125550202',
  email: 'imiforever@gmail.com',
};

// Dummy doc URL (placeholder — no real file needed for internal testing)
const DUMMY_DOC = 'https://example.com/docs/test-placeholder.pdf';
const FUTURE    = new Date('2027-12-31T00:00:00.000Z');

const driverDocs = [
  { docType: 'background_check',    url: DUMMY_DOC, status: 'approved', uploadedAt: new Date(), expiresAt: FUTURE },
  { docType: 'license',             url: DUMMY_DOC, status: 'approved', uploadedAt: new Date(), expiresAt: FUTURE },
  { docType: 'commercial_insurance',url: DUMMY_DOC, status: 'approved', uploadedAt: new Date(), expiresAt: FUTURE },
  { docType: 'insurance',           url: DUMMY_DOC, status: 'approved', uploadedAt: new Date(), expiresAt: FUTURE },
  { docType: 'vehicle_registration',url: DUMMY_DOC, status: 'approved', uploadedAt: new Date(), expiresAt: FUTURE },
  { docType: 'profile_picture',     url: DUMMY_DOC, status: 'approved', uploadedAt: new Date(), expiresAt: null   },
  { docType: 'hard_card',           url: DUMMY_DOC, status: 'approved', uploadedAt: new Date(), expiresAt: FUTURE },
  { docType: 'vehicle_inspection',  url: DUMMY_DOC, status: 'approved', uploadedAt: new Date(), expiresAt: FUTURE },
];

const vehicleData = {
  make:        'BMW',
  model:       '5 Series',
  year:        2024,
  plateNumber: 'TEST-0001',
  color:       'Black',
  powertrain:  'gasoline',
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is not set in .env');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Rider ──────────────────────────────────────────────────────────────────
  const existingRider = await Rider.findOne({ email: riderData.email.toLowerCase() });
  if (existingRider) {
    await Rider.deleteOne({ _id: existingRider._id });
    console.log('Removed existing rider account.');
  }

  const rider = await Rider.create({
    name:         riderData.name,
    phone:        riderData.phone,
    email:        riderData.email.toLowerCase(),
    passwordHash,
    status:       'active',
  });

  console.log('✔ Rider created:');
  console.log(`    Name  : ${rider.name}`);
  console.log(`    Email : ${rider.email}`);
  console.log(`    Pass  : ${PASSWORD}`);
  console.log(`    ID    : ${rider._id}\n`);

  // ── Driver + Vehicle ───────────────────────────────────────────────────────
  const existingDriver = await Driver.findOne({ email: driverData.email.toLowerCase() });
  if (existingDriver) {
    await Vehicle.deleteMany({ driver: existingDriver._id });
    await Driver.deleteOne({ _id: existingDriver._id });
    console.log('Removed existing driver account.');
  }

  const driver = await Driver.create({
    name:         driverData.name,
    phone:        driverData.phone,
    email:        driverData.email.toLowerCase(),
    passwordHash,
    docs:         driverDocs,
    status:       'approved',
    operatingStates: ['IL'],
    chauffeurLicense: {
      licenseNumber: 'TEST-CHAUFFEUR-001',
      issuingState:  'IL',
      status:        'verified',
      verifiedAt:    new Date(),
      expiresAt:     FUTURE,
    },
    vehicleInspection: {
      reportUrl:        DUMMY_DOC,
      status:           'approved',
      uploadedAt:       new Date(),
      expiresAt:        FUTURE,
      inspectionCenter: 'Test Center',
    },
    tripPreferences: {
      serviceDogEnabled: true,
      teenPickupEnabled: false,
    },
  });

  const vehicle = await Vehicle.create({
    driver:      driver._id,
    ...vehicleData,
  });

  await Driver.findByIdAndUpdate(driver._id, { vehicle: vehicle._id });

  console.log('✔ Driver created & approved:');
  console.log(`    Name    : ${driver.name}`);
  console.log(`    Email   : ${driver.email}`);
  console.log(`    Pass    : ${PASSWORD}`);
  console.log(`    Status  : approved`);
  console.log(`    Vehicle : ${vehicleData.year} ${vehicleData.make} ${vehicleData.model} (${vehicleData.color})`);
  console.log(`    Plate   : ${vehicleData.plateNumber}`);
  console.log(`    ID      : ${driver._id}\n`);

  console.log('─────────────────────────────────────────');
  console.log('Ready for internal testing!');
  console.log('─────────────────────────────────────────');
  console.log(`  Rider  App → stylerspot@gmail.com  /  ${PASSWORD}`);
  console.log(`  Driver App → imiforever@gmail.com  /  ${PASSWORD}`);
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
