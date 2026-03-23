const express = require('express');
const router = express.Router();

const Driver = require('../models/Driver');   // adjust path if needed
const auth = require('../middleware/auth');   // JWT middleware

// GET /api/driver/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    return res.json(driver);
  } catch (err) {
    console.error('Error in /api/driver/profile:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;