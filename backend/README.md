# Rydinex Backend

Driver + Rider onboarding backend APIs, including document upload, rider payment methods, Stripe Connect account creation, and admin payment logs.

## Prerequisites

- Node.js 18+
- MongoDB Atlas connection string
- Redis instance (optional for current onboarding APIs; app runs if unavailable)
- AWS S3 bucket + credentials (required for driver document upload endpoint)
- Stripe secret key (required for live Stripe Connect + payment method flows; mock fallback works without it)
- Pricing/surge environment variables (base fare, distance/time rates, demand surge, commission)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create environment file:

   ```bash
   copy .env.example .env
   ```

3. Update `.env` with real MongoDB, Redis, AWS, and Stripe values.

4. Start API server:

   ```bash
   npm start
   ```

Server runs on `http://localhost:4000` by default.

## Security Hardening

The backend now ships with baseline API hardening enabled by default:

- Security headers middleware (`X-Content-Type-Options`, `X-Frame-Options`, CSP, HSTS when HTTPS)
- Global in-memory request rate limiting
- Route-level stricter rate limits for registration, payments, trips, and airport queue writes
- Request payload size limit via `REQUEST_BODY_LIMIT`
- Centralized request validation and sanitization for high-risk write endpoints

Security/rate-limit related environment variables:

- `CORS_ORIGIN`
- `REQUEST_BODY_LIMIT`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_DRIVER_REGISTER_MAX`
- `RATE_LIMIT_DRIVER_DOCUMENT_UPLOAD_MAX`
- `RATE_LIMIT_RIDER_REGISTER_MAX`
- `RATE_LIMIT_RIDER_PAYMENT_METHOD_MAX`
- `RATE_LIMIT_TRIP_PRICING_MAX`
- `RATE_LIMIT_TRIP_WRITE_MAX`
- `RATE_LIMIT_AIRPORT_QUEUE_WRITE_MAX`

## Backend Testing Suites

Run middleware unit tests:

```bash
npm test
```

Run load testing:

```bash
npm run test:load
```

Optional arguments:

- `--baseUrl http://localhost:4000`
- `--path /api/health`
- `--method GET`
- `--durationSec 30`
- `--concurrency 20`

Run surge stress testing:

```bash
npm run test:surge
```

Optional arguments:

- `--baseUrl http://localhost:4000`
- `--requests 250`
- `--concurrency 25`
- `--surgeRadiusKm 5`

Run airport queue testing (requires approved driver IDs):

```bash
set AIRPORT_QUEUE_DRIVER_IDS=<driver_id_1>,<driver_id_2>,<driver_id_3>
npm run test:queue
```

Optional arguments:

- `--baseUrl http://localhost:4000`
- `--driverIds id1,id2,id3`
- `--cleanup true`

Run payment testing (creates test riders and test payment methods):

```bash
npm run test:payment
```

Optional arguments:

- `--baseUrl http://localhost:4000`
- `--users 30`
- `--concurrency 10`

By default, payment tests refuse to run with a non-test Stripe key unless `PAYMENT_TEST_ALLOW_LIVE=true` is set.

## Seed Driver Onboarding Data

Seed one sample pending driver + vehicle:

```bash
npm run seed:driver-onboarding
```

Seed output includes the generated `driverId`, plus sample credentials.

## API Smoke Test (Postman)

Import these files into Postman:

- `postman/driver-onboarding.collection.json`
- `postman/driver-onboarding.environment.json`

Then run requests in order:

1. Health Check
2. Register Driver (auto-saves `driverId`)
3. Upload Driver Document
4. Save Vehicle Info
5. Get Driver Status
6. Admin List Drivers
7. Admin Approve Driver / Admin Reject Driver

## API Smoke Test (PowerShell)

```powershell
$base = "http://localhost:4000/api"

# Register driver
$register = Invoke-RestMethod -Method Post -Uri "$base/drivers/register" -ContentType "application/json" -Body (@{
   name = "CLI Driver"
   phone = "+15551000003"
   email = "cli.driver@rydinex.com"
   password = "Passw0rd!123"
} | ConvertTo-Json)

$driverId = $register.driver.id

# Upload one document (requires valid AWS S3 credentials in .env)
Invoke-RestMethod -Method Post -Uri "$base/drivers/$driverId/documents" -Form @{
   docType = "license"
   document = Get-Item ".\postman\sample-document.txt"
}

# Save vehicle
Invoke-RestMethod -Method Post -Uri "$base/drivers/$driverId/vehicle" -ContentType "application/json" -Body (@{
   make = "Nissan"
   model = "Sentra"
   year = 2020
   plateNumber = "URD-7007"
   color = "White"
} | ConvertTo-Json)

# Get status
Invoke-RestMethod -Method Get -Uri "$base/drivers/$driverId/status"

# Approve in admin workflow
Invoke-RestMethod -Method Patch -Uri "$base/admin/drivers/$driverId/review" -ContentType "application/json" -Body (@{
   action = "approve"
} | ConvertTo-Json)
```

## Driver Onboarding Endpoints

- `POST /api/drivers/register`
- `POST /api/drivers/:driverId/documents` (multipart form-data: `docType`, `document`, optional `expiresAt` ISO date)
- `POST /api/drivers/:driverId/vehicle`
- `POST /api/drivers/:driverId/trip-preferences` (`serviceDogEnabled`, `teenPickupEnabled`)
- `GET /api/drivers/:driverId/status`
- `GET /api/admin/drivers?status=pending`
- `PATCH /api/admin/drivers/:driverId/review`

Chicago premium service policy (`black_car`, `black_suv`):

- Required credential set before approval/dispatch: `chauffeur_license` (or `taxi_chauffeur_license`), `hard_card`, `license`, `commercial_insurance`, `vehicle_registration`, `profile_picture`, `background_check`.
- Additional compliance checks remain active: vehicle inspection verification and state-level chauffeur rules.

## Rider Onboarding + Payments Endpoints

- `POST /api/riders/register`
- `POST /api/riders/:riderId/payment-methods`
- `GET /api/riders/:riderId/payment-methods`
- `GET /api/riders/:riderId/home`
- `GET /api/admin/riders?status=active`
- `GET /api/admin/payment-logs?limit=100`

## Trip Engine Endpoints

- `POST /api/trips/upfront-pricing`
- `POST /api/trips/request`
- `GET /api/trips/driver/:driverId/incoming`
- `GET /api/trips/driver/:driverId/current`
- `POST /api/trips/:tripId/driver-response` (`accept` or `decline`)
- `POST /api/trips/:tripId/start`
- `POST /api/trips/:tripId/track`
- `POST /api/trips/:tripId/end`
- `PATCH /api/trips/:tripId/status`
- `POST /api/trips/:tripId/activate` (activates `scheduled` reservation/hourly trip for driver matching)
- `GET /api/trips/:tripId/tracking`
- `GET /api/trips/:tripId/summary`
- `POST /api/trips/:tripId/receipt/generate`
- `GET /api/trips/:tripId/receipt`
- `GET /api/trips/rider/:riderId/active`
- `GET /api/trips/:tripId`

## Pricing + Surge Engine

Ride categories:

- `rydinex_regular`
- `rydinex_comfort`
- `rydinex_xl`
- `rydinex_green` (hybrid/electric, 2013+ vehicle eligibility)
- Legacy aliases remain accepted: `black_car`, `black_suv`, `suv`

Booking types:

- `on_demand`
- `reservation` (requires `scheduledAt`)
- `hourly` (requires `scheduledAt` and `estimatedHours`)

Trip request/pricing payload fields:

- `rideCategory`
- `bookingType`
- `scheduledAt` (ISO datetime)
- `estimatedHours` (hourly only)
- `isPrearranged`
- `serviceDogRequested`
- `teenPickup`
- `teenSeatingPolicy` (`back_seat_only` enforced for teen pickups)
- `specialInstructions`

Configured via `.env`:

- `PRICING_BASE_FARE`
- `PRICING_PER_MILE_RATE`
- `PRICING_PER_MINUTE_RATE`
- `PRICING_AVERAGE_SPEED_MPH`
- `PRICING_CURRENCY`
- `SURGE_DEMAND_RADIUS_KM`
- `SURGE_SENSITIVITY`
- `SURGE_MAX_MULTIPLIER`
- `PLATFORM_COMMISSION_RATE`
- `PRICING_RYDINEX_REGULAR_BASE_FARE`
- `PRICING_RYDINEX_REGULAR_PER_MINUTE`
- `PRICING_RYDINEX_REGULAR_PER_MILE`
- `PRICING_RYDINEX_REGULAR_HOURLY_RATE`
- `PRICING_RYDINEX_COMFORT_BASE_FARE`
- `PRICING_RYDINEX_COMFORT_PER_MINUTE`
- `PRICING_RYDINEX_COMFORT_PER_MILE`
- `PRICING_RYDINEX_COMFORT_HOURLY_RATE`
- `PRICING_RYDINEX_XL_BASE_FARE`
- `PRICING_RYDINEX_XL_PER_MINUTE`
- `PRICING_RYDINEX_XL_PER_MILE`
- `PRICING_RYDINEX_XL_HOURLY_RATE`
- `PRICING_RYDINEX_GREEN_BASE_FARE`
- `PRICING_RYDINEX_GREEN_PER_MINUTE`
- `PRICING_RYDINEX_GREEN_PER_MILE`
- `PRICING_RYDINEX_GREEN_HOURLY_RATE`
- `PRICING_RESERVATION_FEE`
- `PRICING_SERVICE_DOG_FEE`
- `PRICING_HOURLY_MIN_HOURS`
- `SURGE_RYDINEX_REGULAR_SENSITIVITY`
- `SURGE_RYDINEX_REGULAR_MAX_MULTIPLIER`
- `SURGE_RYDINEX_COMFORT_SENSITIVITY`
- `SURGE_RYDINEX_COMFORT_MAX_MULTIPLIER`
- `SURGE_RYDINEX_XL_SENSITIVITY`
- `SURGE_RYDINEX_XL_MAX_MULTIPLIER`
- `SURGE_RYDINEX_GREEN_SENSITIVITY`
- `SURGE_RYDINEX_GREEN_MAX_MULTIPLIER`
- `RYDINEX_MIN_VEHICLE_YEAR`
- `RYDINEX_GREEN_MIN_VEHICLE_YEAR`
- `AIRPORT_QUEUE_STRICT`
- `AIRPORT_QUEUE_AVG_ASSIGNMENT_MINUTES`
- `AIRPORT_PICKUP_FEE_ORD`
- `AIRPORT_DROPOFF_FEE_ORD`
- `AIRPORT_PICKUP_FEE_MDW`
- `AIRPORT_DROPOFF_FEE_MDW`
- `SCHEDULED_ASSIGNMENT_WINDOW_MINUTES`
- `RESERVATION_MIN_LEAD_MINUTES`

Trip pricing output includes:

- upfront fare estimate
- surge multiplier (from demand/supply ratio)
- service dog surcharge (when requested)
- platform commission amount/rate
- driver earnings per trip

## Airport Queue System (ORD + MDW)

Airport queue APIs:

- `GET /api/airport-queue/geofences`
- `GET /api/airport-queue/pickup-instructions?latitude=41.98&longitude=-87.90`
- `GET /api/airport-queue/driver/:driverId/status?latitude=41.98&longitude=-87.90`
- `POST /api/airport-queue/enter`
- `POST /api/airport-queue/exit`

Notes:

- ORD and MDW geofence polygons are applied on backend for queue and pickup instruction logic.
- FIFO queue assignment is used for airport pickups (strict mode configurable with `AIRPORT_QUEUE_STRICT`).
- Airport pickup/dropoff fees are automatically applied in pricing for ORD/MDW trips.

## Compliance System

Core APIs:

- `POST /api/complaints`
- `GET /api/complaints` (admin auth)
- `PATCH /api/complaints/:complaintId/status` (admin auth)

Admin compliance APIs (all require admin auth):

- `GET /api/admin/compliance/logs/trips`
- `GET /api/admin/compliance/logs/drivers`
- `GET /api/admin/compliance/logs/safety`
- `GET /api/admin/compliance/incidents`
- `PATCH /api/admin/compliance/incidents/:incidentId`
- `GET /api/admin/compliance/documents/expirations?thresholdDays=30`
- `GET /api/admin/compliance/reports/compliance/summary`
- `GET /api/admin/compliance/export?dataset=complaints&format=json`
- `GET /api/admin/compliance/export?dataset=trip_logs&format=csv`

Export datasets:

- `complaints`
- `safety_logs`
- `trip_logs`
- `driver_logs`
- `document_alerts`
