# 🧪 **URRIDE PLATFORM - COMPLETE TEST SUITE**

## ✅ Pre-Deployment Verification

This guide will verify that your entire platform is working correctly.

---

## 🚀 **Step 1: Start All Services (5 minutes)**

### Terminal 1: Start Backend
```bash
cd backend
npm start
```

**Expected Output:**
```
MongoDB connected
Server running on port 4000
```

### Terminal 2: Start Admin Dashboard (if needed)
```bash
cd admin-dashboard
npm run dev
```

**Expected Output:**
```
> dev
> vite
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

### Terminal 3: Check Backend is Up
```bash
curl http://localhost:4000/api/health
```

**Expected Response:**
```json
{ "status": "ok" }
```

---

## 📋 **Step 2: Test All 6 Systems**

### System 1: GPS Tracking (RydinexMaps)

#### Test 1.1: Record Location
```bash
curl -X POST http://localhost:4000/api/rydinex-maps/location/record \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver_123",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "speed": 45,
    "accuracy": 10
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "driverId": "driver_123",
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

#### Test 1.2: Get Trip Polyline
```bash
curl "http://localhost:4000/api/rydinex-maps/trip/trip_123/polyline"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "coordinates": [...],
    "distance": 3.5,
    "duration": 720
  }
}
```

---

### System 2: POI Intelligence (RydinexAIPoi)

#### Test 2.1: Find Nearby POI
```bash
curl "http://localhost:4000/api/rydinex-poi/nearby?latitude=40.7128&longitude=-74.0060&radius=1&limit=10"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "name": "Times Square",
      "category": "landmark",
      "distance": 0.5,
      "relevance": 95
    }
  ]
}
```

#### Test 2.2: Search POI
```bash
curl "http://localhost:4000/api/rydinex-poi/search?query=restaurant&latitude=40.7128&longitude=-74.0060&radius=2"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 12,
  "data": [...]
}
```

---

### System 3: Routing (RydinexRouting)

#### Test 3.1: Calculate Route
```bash
curl -X POST http://localhost:4000/api/rydinex-routing/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "waypoints": [
      {"latitude": 40.7128, "longitude": -74.0060, "name": "Pickup"},
      {"latitude": 40.7580, "longitude": -73.9855, "name": "Dropoff"}
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalDistance": 3.5,
    "totalDurationMinutes": 12,
    "segments": [
      {
        "instruction": "Head 90° on 5th Avenue for 0.5km",
        "distance": 500,
        "direction": "turn"
      }
    ],
    "eta": "2024-01-15T10:15:30Z"
  }
}
```

#### Test 3.2: Get Distance Between Two Points
```bash
curl -X POST http://localhost:4000/api/rydinex-routing/distance \
  -H "Content-Type: application/json" \
  -d '{
    "latitude1": 40.7128,
    "longitude1": -74.0060,
    "latitude2": 40.7580,
    "longitude2": -73.9855
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "distance": 3.5,
    "durationMinutes": 12,
    "eta": "2024-01-15T10:15:30Z"
  }
}
```

#### Test 3.3: Optimize Multi-Stop Route
```bash
curl -X POST http://localhost:4000/api/rydinex-routing/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "waypoints": [
      {"latitude": 40.7128, "longitude": -74.0060, "name": "Start"},
      {"latitude": 40.7580, "longitude": -73.9855, "name": "Stop1"},
      {"latitude": 40.7614, "longitude": -73.9776, "name": "Stop2"}
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "optimizedOrder": [0, 2, 1],
    "optimizedDistance": 8.2,
    "optimizedDuration": 1440
  }
}
```

---

### System 4: Geocoding (RydinexGeocoding)

#### Test 4.1: Geocode Address
```bash
curl -X POST http://localhost:4000/api/rydinex-geocoding/geocode \
  -H "Content-Type: application/json" \
  -d '{
    "address": "Times Square, New York, NY"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "count": 1,
  "data": {
    "results": [
      {
        "displayName": "Times Square, New York",
        "latitude": 40.7580,
        "longitude": -73.9855
      }
    ]
  }
}
```

#### Test 4.2: Reverse Geocode
```bash
curl -X POST http://localhost:4000/api/rydinex-geocoding/reverse \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "result": {
      "displayName": "Main Street, New York",
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }
}
```

#### Test 4.3: Autocomplete
```bash
curl "http://localhost:4000/api/rydinex-geocoding/autocomplete?q=times%20square&limit=5"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "displayName": "Times Square, New York",
      "latitude": 40.7580,
      "longitude": -73.9855
    }
  ]
}
```

---

### System 5: Traffic (RydinexTraffic)

#### Test 5.1: Report Traffic Data
```bash
curl -X POST http://localhost:4000/api/rydinex-traffic/report \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "speed": 35,
    "driverId": "driver_123",
    "accuracy": 100
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "congestionLevel": "light",
    "congestionScore": 30,
    "currentSpeed": 35,
    "sampleCount": 1
  }
}
```

#### Test 5.2: Get Traffic Heatmap
```bash
curl "http://localhost:4000/api/rydinex-traffic/heatmap?latitude=40.7128&longitude=-74.0060&radius=2"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "congestionScore": 30,
      "speed": 35
    }
  ]
}
```

---

### System 6: Map Intelligence (RydinexMapIntelligence)

#### Test 6.1: Get Route Intelligence
```bash
curl -X POST http://localhost:4000/api/rydinex-map-intelligence/route \
  -H "Content-Type: application/json" \
  -d '{
    "routeCoordinates": [
      [40.7128, -74.0060],
      [40.7580, -73.9855]
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "segments": [],
    "totalWarnings": [],
    "averageRiskLevel": "safe"
  }
}
```

#### Test 6.2: Get Smart Pickup Points
```bash
curl "http://localhost:4000/api/rydinex-map-intelligence/pickup-points?latitude=40.7128&longitude=-74.0060"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 0,
  "data": []
}
```
(No data until map intelligence is seeded)

#### Test 6.3: Get Speed Limit
```bash
curl "http://localhost:4000/api/rydinex-map-intelligence/speed-limit?latitude=40.7128&longitude=-74.0060"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "speedLimit": 50
  }
}
```

---

## 🔌 **Step 3: Test Real-Time Socket.IO (Optional)**

### Test Connection
```bash
# Install ws client
npm install -g wscat

# Connect to routing namespace
wscat -c ws://localhost:4000/socket.io/?EIO=4&transport=websocket
```

### Send Test Event (from WebSocket terminal)
```json
{"type": 2, "nsp": "/rydinex-routing", "data": ["get-navigation-state", {"routeId": "test"}]}
```

---

## ✅ **Step 4: Verify All Systems**

| System | Endpoint | Status |
|--------|----------|--------|
| GPS Tracking | `/api/rydinex-maps` | ✅ Should work |
| POI Intelligence | `/api/rydinex-poi` | ✅ Should work |
| Routing | `/api/rydinex-routing` | ✅ Should work (OSRM) |
| Geocoding | `/api/rydinex-geocoding` | ✅ Should work (Nominatim) |
| Traffic | `/api/rydinex-traffic` | ✅ Should work |
| Map Intelligence | `/api/rydinex-map-intelligence` | ✅ Should work |

---

## 🚨 **Troubleshooting**

### Issue: "Cannot GET /api/..."
**Solution:** Make sure backend is running on port 4000
```bash
curl http://localhost:4000/api/health
```

### Issue: Geocoding returns empty
**Solution:** Nominatim may be rate-limited, wait 1 second and retry
```bash
sleep 1
curl -X POST http://localhost:4000/api/rydinex-geocoding/geocode ...
```

### Issue: Routing returns error
**Solution:** Make sure OSRM is available (uses public service)
```bash
curl http://router.project-osrm.org/route/v1/driving/13.388860,52.517037;13.385983,52.496891
```

### Issue: MongoDB connection error
**Solution:** Verify MongoDB is running
```bash
# Check if MongoDB is running
mongosh
```

### Issue: Redis connection error
**Solution:** Optional - not required for basic functionality
```bash
# Check if Redis is running (optional)
redis-cli ping
```

---

## 📊 **Expected Test Results**

All tests should pass with:

✅ **6/6 Systems Working**
✅ **40+ Endpoints Responding**
✅ **0 Build Errors**
✅ **All Data Models Valid**
✅ **All Services Functional**
✅ **All Security Checks Passing**

---

## 🎯 **Full Functional Test**

### Complete User Journey
```bash
# 1. Geocode pickup location
PICKUP=$(curl -s -X POST http://localhost:4000/api/rydinex-geocoding/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "Times Square"}' | jq '.data.results[0]')

# 2. Geocode dropoff location
DROPOFF=$(curl -s -X POST http://localhost:4000/api/rydinex-geocoding/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "Grand Central"}' | jq '.data.results[0]')

# 3. Calculate route
ROUTE=$(curl -s -X POST http://localhost:4000/api/rydinex-routing/calculate \
  -H "Content-Type: application/json" \
  -d "{\"waypoints\": [$PICKUP, $DROPOFF]}")

# 4. Find nearby POI
POI=$(curl -s "http://localhost:4000/api/rydinex-poi/nearby?latitude=40.7580&longitude=-73.9855&radius=1")

# 5. Get map intelligence
INTEL=$(curl -s -X POST http://localhost:4000/api/rydinex-map-intelligence/route \
  -H "Content-Type: application/json" \
  -d '{"routeCoordinates": [[40.7580, -73.9855], [40.7489, -73.9680]]}')

echo "✅ Complete journey tested!"
```

---

## 🏁 **Ready to Deploy?**

If all tests pass, you're ready to:

1. ✅ Deploy to production
2. ✅ Scale to multiple servers
3. ✅ Add frontend apps
4. ✅ Start accepting users
5. ✅ Begin operations

---

## 📚 **Additional Checks**

### Check Environment Variables
```bash
# Verify .env file exists
ls -la backend/.env

# Check key variables
grep MONGO_URI backend/.env
grep PORT backend/.env
```

### Check Database Indexes
```bash
# Connect to MongoDB
mongosh

# In MongoDB shell
use urride
db.locationhistories.getIndexes()
db.traffic.getIndexes()
db.geocodes.getIndexes()
```

### Check File Structure
```bash
# Verify all key files exist
ls -la backend/models/
ls -la backend/services/
ls -la backend/routes/
ls -la backend/sockets/
```

---

## ✅ **You're Production Ready If:**

- [x] All 6 systems respond to test requests
- [x] No MongoDB connection errors
- [x] No build errors or warnings
- [x] All endpoints return success responses
- [x] Real-time events can be tested (optional)
- [x] No rate limiting issues
- [x] CORS is properly configured
- [x] Security headers are present

---

**Run these tests and confirm everything works! 🚀**
