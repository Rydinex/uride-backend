# URide Configuration Setup Guide

## Status

All backend implementation files have been created in `backend/` directory. Configuration files are ready at root level.

## Environment Files Created

✅ `.env` (Production-like defaults)
✅ `.env.development` (Local development)
✅ `.env.production` (Railway deployment)

## Files Created

### Backend Core
- `backend/app.js` - Main Express server with Socket.IO
- `backend/services/redisClient.js` - Redis connection manager
- `backend/services/tokenService.js` - JWT token generation/verification
- `backend/middleware/securityHeaders.js` - Security headers
- `backend/middleware/rateLimit.js` - Request rate limiting
- `backend/middleware/auth.js` - Authentication & authorization
- `backend/sockets/locationSocket.js` - Real-time location tracking

### Routes
- `backend/routes/auth.js` - Login, signup, token verification
- `backend/routes/users.js` - User profile management
- `backend/routes/rides.js` - Ride request & management
- `backend/routes/drivers.js` - Driver profiles & status
- `backend/routes/payments.js` - Stripe payment integration
- `backend/routes/locations.js` - Location search & nearby places
- `backend/routes/airportQueue.js` - Airport queue management

## Next Steps: Update Configuration

### Missing Credentials (Update before deployment)

#### 1. MongoDB (`.env` MONGO_URI)
- **Current**: `mongodb+srv://rydinex_user:rydinex_password@cluster0.mongodb.net/uride`
- **Action**: Replace with your actual MongoDB Atlas connection string
- **Format**: `mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE`
- **Location**: https://mongodb.com/cloud/atlas

#### 2. Redis (`.env` REDIS_URL / REDIS_URI)
- **Current**: `redis://default:redis_password@localhost:6379`
- **For Development**: Keep localhost if Redis running locally
- **For Production**: Use Upstash or AWS ElastiCache
- **Format**: `redis://[user:password]@host:port`
- **Upstash**: https://console.upstash.com

#### 2a. PostgreSQL (`DATABASE_URL` or `PG*`)
- **Required For**: PRD prototype event ingestion at `/api/prd/events`
- **Preferred**: `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE`
- **Alternative**: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- **Optional SSL**: `PGSSL=true`
- **Setup**: Run the Rider, Driver, and Admin SQL schema files before posting events

#### 3. Stripe Keys (`.env` STRIPE_*)
- **TEST Keys**: `sk_test_...` and `pk_test_...`
- **LIVE Keys**: `sk_live_...` and `pk_live_...`
- **Location**: https://dashboard.stripe.com/apikeys
- **Test Card**: 4242 4242 4242 4242 (expires future, any CVC)

#### 4. Google APIs (`.env` GOOGLE_*)
- **Maps API Key**: For Maps SDK
  - Enable: Maps SDK for JavaScript
  - Location: https://console.cloud.google.com
  
- **OAuth Credentials**: For authentication
  - Create OAuth 2.0 credentials (Web application)
  - Redirect URI: `http://localhost:3000/api/auth/google/callback`
  - **Client ID**: For frontend
  - **Client Secret**: For backend

#### 5. JWT Secret (`.env` JWT_SECRET)
- **Current**: `dev_jwt_secret_key_change_in_production`
- **Generate Strong Secret**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## Running the Backend

### Development
```bash
# Install dependencies (if not already done)
cd backend
npm install

# Start with nodemon (auto-reload)
npm install -D nodemon
npx nodemon app.js

# Or simple start
npm start
```

### Environment Setup
1. Copy `.env.development` → actual `.env` for local dev
2. Update values with your actual credentials
3. Ensure MongoDB runs locally OR update URI for remote DB
4. Ensure Redis runs locally OR update URI for remote Redis

### Testing API
```bash
# Health check
curl http://localhost:4000/api/health

# PRD event ingestion
curl -X POST http://localhost:4000/api/prd/events \
  -H "Content-Type: application/json" \
  -d '{"type":"screen.view","folder":"rydinex_rider_selection_1","payload":{"source":"manual-test"}}'

# Login (test)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Frontend Configuration

Frontend already has:
- `frontend/.env.example` with API endpoint
- `next.config.js` configured
- Tailwind & PostCSS ready

Update `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Admin dashboard `.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
```

## Railway Deployment (Production)

When deploying to Railway:

1. **Add Environment Variables in Railway Dashboard**:
   - Copy all values from `.env.production`
   - Set actual production values

2. **MongoDB Atlas**:
   - Create free cluster
   - Add IP whitelist (0.0.0.0 for Railway)
   - Get connection string → `MONGO_URI`

3. **Upstash Redis**:
   - Create free Redis database
   - Get connection string → `REDIS_URL`

4. **Domain Setup**:
   - See `PRD/DEPLOY_RYDINEX_DOMAIN.md` for detailed instructions

### Production Domains

- Backend Railway: `https://uride-backend-production.up.railway.app`
- Backend custom domain: `https://api.rydinex.com`
- Frontend Railway: `https://uride-production.up.railway.app`
- Frontend Railway alias: `https://trustworthy-purpose-production.up.railway.app`
- Frontend custom domains: `https://rydinex.com`, `https://www.rydinex.com`
- Admin Railway: `https://genuine-grace-production-6f60.up.railway.app`
- Admin custom domain: `https://admin.rydinex.com`

Recommended Railway variables:
```
# backend service
CORS_ORIGIN=https://rydinex.com,https://www.rydinex.com,https://uride-production.up.railway.app,https://trustworthy-purpose-production.up.railway.app,https://admin.rydinex.com,https://genuine-grace-production-6f60.up.railway.app

# frontend service
NEXT_PUBLIC_API_URL=https://api.rydinex.com
NEXT_PUBLIC_SITE_URL=https://rydinex.com

# admin service
NEXT_PUBLIC_BACKEND_URL=https://api.rydinex.com
NEXT_PUBLIC_ADMIN_URL=https://admin.rydinex.com
BACKEND_BASE_URL=https://api.rydinex.com
```

## Security Checklist

- [ ] MongoDB credentials secured (not in git)
- [ ] Redis password changed from default
- [ ] JWT_SECRET is strong & unique
- [ ] Stripe uses test keys in dev, live keys in prod
- [ ] CORS_ORIGIN restricted in production
- [ ] All .env files in .gitignore
- [ ] No secrets logged in production

## Troubleshooting

**MongoDB Connection Error**:
- Check MONGO_URI format
- Verify IP whitelist if using Atlas
- Test connection: `mongo "mongodb+srv://user:pass@cluster.mongodb.net/db"`

**Redis Connection Error**:
- Ensure Redis server is running
- Check host/port in REDIS_URL
- For local: `redis-cli ping` (should return PONG)

**Stripe Payment Failed**:
- Verify STRIPE_SECRET_KEY is set
- Use test key (sk_test_) in development
- Check test card details

**Google API Errors**:
- Verify API is enabled in Google Cloud Console
- Check GOOGLE_MAPS_API_KEY has Maps enabled
- Whitelist domain in API restrictions

---

**Note**: Sensitive values are marked with placeholder credentials. Replace with actual values before running in production!
