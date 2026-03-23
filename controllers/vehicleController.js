const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const { createDriverLog } = require('../services/complianceLogService');
const {
  validateDriverTypeAndCategory,
  validateVehicleYear,
} = require('../utils/drivervalidation');

async function upsertVehicle(req, res) {
  try {
    const { driverId } = req.params;
    const { make, model, year, plateNumber, color, powertrain = 'gasoline', photoUrl = null, rideCategory } = req.body;

    if (!make || !model || !year || !plateNumber) {
      return res.status(400).json({ message: 'make, model, year and plateNumber are required.' });
    }

    const yearError = validateVehicleYear(req.body.year);
    if (yearError) {
      return res.status(400).json({ error: yearError });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const categoryError = validateDriverTypeAndCategory(driver.driverType || req.body.driverType, rideCategory);

    if (categoryError) {
      return res.status(400).json({ error: categoryError });
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { driver: driverId },
      { make, model, year, plateNumber, color, powertrain, photoUrl },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    driver.vehicle = vehicle._id;
    await driver.save();

    await createDriverLog({
      driver: driver._id,
      eventType: 'vehicle_updated',
      actorType: 'driver',
      actorId: String(driver._id),
      severity: 'info',
      metadata: {
        vehicleId: vehicle._id,
        make,
        model,
        year,
        plateNumber,
        powertrain,
        hasPhotoUrl: Boolean(photoUrl),
      },
    }).catch(() => null);

    return res.status(200).json({ message: 'Vehicle info saved.', vehicle });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save vehicle info.' });
  }
}

module.exports = {
  upsertVehicle,
};