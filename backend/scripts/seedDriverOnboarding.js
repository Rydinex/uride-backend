require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');

const seedDriver = {
  name: 'Sample Driver',
  phone: '+15551000001',
  email: 'sample.driver@rydinex.com',
  password: 'Passw0rd!123',
  docs: [
    {
      docType: 'license',
      url: 'https://example.com/docs/sample-license.pdf',
      status: 'pending',
    },
    {
      docType: 'national_id',
      url: 'https://example.com/docs/sample-national-id.pdf',
      status: 'pending',
    },
  ],
  vehicle: {
    make: 'Toyota',
    model: 'Corolla',
    year: 2022,
    plateNumber: 'URD-1234',
    color: 'Silver',
  },
};

async function seed() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in .env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existingDriver = await Driver.findOne({ email: seedDriver.email.toLowerCase() });
  if (existingDriver) {
    await Vehicle.deleteMany({ driver: existingDriver._id });
    await Driver.deleteOne({ _id: existingDriver._id });
  }

  const passwordHash = await bcrypt.hash(seedDriver.password, 10);

  const driver = await Driver.create({
    name: seedDriver.name,
    phone: seedDriver.phone,
    email: seedDriver.email,
    passwordHash,
    docs: seedDriver.docs,
    status: 'pending',
  });

  const vehicle = await Vehicle.create({
    driver: driver._id,
    ...seedDriver.vehicle,
  });

  driver.vehicle = vehicle._id;
  await driver.save();

  console.log('Seeded driver onboarding data:');
  console.log(`Driver ID: ${driver._id}`);
  console.log(`Email: ${seedDriver.email}`);
  console.log(`Password: ${seedDriver.password}`);
  console.log(`Status: ${driver.status}`);

  await mongoose.disconnect();
}

seed()
  .then(() => process.exit(0))
  .catch(async error => {
    console.error('Failed to seed driver onboarding data:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
