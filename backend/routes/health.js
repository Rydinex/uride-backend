const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

router.get('/', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  return res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'OK' : 'DEGRADED',
    message: databaseConnected
      ? 'Rydinex Backend is healthy'
      : 'Rydinex Backend is running but database is unavailable',
    services: {
      database: databaseConnected ? 'connected' : 'disconnected',
    },
  });
});

module.exports = router;