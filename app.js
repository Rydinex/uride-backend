const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { getRedisClient } = require('./services/redisClient');
const { registerLocationSocketHandlers } = require('./sockets/locationSocket');
const { registerRydinexMapsSocketHandlers } = require('./sockets/rydinexMapsSocket');
const { registerRydinexRoutingSocketHandlers } = require('./sockets/rydinexRoutingSocket');
const { registerRydinexTrafficSocketHandlers } = require('./sockets/rydinexTrafficSocket');

const { securityHeaders } = require('./middleware/securityHeaders');
const { createRateLimiter } = require('./middleware/rateLimit');

const app = express();
app.disable('x-powered-by');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

app.locals.io = io;

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Redis
const redisClient = getRedisClient();
app.locals.redisClient = redisClient;

// Middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
const parsedCorsOrigin = corsOrigin.includes(',')
  ? corsOrigin.split(',').map(o => o.trim()).filter(Boolean)
  : corsOrigin;

const globalRateLimiter = createRateLimiter({
  identifier: 'global',
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 240),
  message: 'Too many requests. Please try again in a moment.',
});

app.use(securityHeaders);
app.use(
  cors({
    origin: parsedCorsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '256kb' }));
app.use(globalRateLimiter);

// Root
app.get('/', (req, res) => {
  return res.status(200).json({
    status: 'OK',
    message: 'Rydinex Backend is running',
    health: '/api/health',
  });
});

// Health
app.use('/api/health', require('./routes/health'));

// DB check middleware
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();

  return res.status(503).json({
    message: 'Database unavailable. Check MongoDB connection settings.',
  });
});

// Routes
app.use('/api/public', require('./routes/public'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/riders', require('./routes/riders'));
app.use('/api/location', require('./routes/location'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/airport-queue', require('./routes/airportQueue'));
app.use('/api/complaints', require('./routes/complaints'));

app.use('/api/admin/auth', require('./routes/adminAuth'));
app.use('/api/admin', require('./routes/adminDrivers'));
app.use('/api/admin', require('./routes/adminRiders'));
app.use('/api/admin', require('./routes/adminTrips'));
app.use('/api/admin', require('./routes/adminControls'));
app.use('/api/admin/compliance', require('./routes/adminCompliance'));
app.use('/api/admin/airport', require('./routes/adminAirportRoutes'));
app.use('/admin/airport', require('./routes/adminAirportRoutes'));

app.use('/api/rydinex-maps', require('./routes/rydinexMaps'));
app.use('/api/rydinex-poi', require('./routes/rydinexAIPoi'));
app.use('/api/rydinex-routing', require('./routes/rydinexRouting'));
app.use('/api/rydinex-geocoding', require('./routes/rydinexGeocoding'));
app.use('/api/rydinex-traffic', require('./routes/rydinexTraffic'));
app.use('/api/rydinex-map-intelligence', require('./routes/rydinexMapIntelligence'));

// 🔥 NEW — REQUIRED BY DRIVER APP
// This is the missing route that fixes the map, online/offline, vehicle info, etc.
app.use('/api/driver', require('./routes/driverProfile'));


// Error handlers
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Invalid JSON payload.' });
  }
  return next(error);
});

app.use((req, res) => {
  return res.status(404).json({ message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled API error:', error);
  return res.status(500).json({ message: 'Internal server error.' });
});

// Socket.IO
registerLocationSocketHandlers(io);
registerRydinexMapsSocketHandlers(io);
registerRydinexRoutingSocketHandlers(io);
registerRydinexTrafficSocketHandlers(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});