# ⚡ **QUICK COPY-PASTE REFERENCE**

## 🚀 **TERMINAL 1: Backend**

```bash
cd backend && npm start
```

Wait for: `Server running on port 4000`

---

## 🚀 **TERMINAL 2: Admin Dashboard**

```bash
cd admin-dashboard && npm run dev
```

Wait for: `Local: http://localhost:3000`

---

## 🌐 **BROWSER**

```
http://localhost:3000
```

---

## 🧪 **5 QUICK TESTS (TERMINAL 3)**

### Test 1: GPS
```bash
curl -X POST http://localhost:4000/api/rydinex-maps/location/record -H "Content-Type: application/json" -d "{\"driverId\":\"test\",\"latitude\":40.7128,\"longitude\":-74.0060,\"speed\":45,\"accuracy\":10}"
```

### Test 2: Routing
```bash
curl -X POST http://localhost:4000/api/rydinex-routing/calculate -H "Content-Type: application/json" -d "{\"waypoints\":[{\"latitude\":40.7128,\"longitude\":-74.0060},{\"latitude\":40.7580,\"longitude\":-73.9855}]}"
```

### Test 3: Geocoding
```bash
curl -X POST http://localhost:4000/api/rydinex-geocoding/geocode -H "Content-Type: application/json" -d "{\"address\":\"Times Square\"}"
```

### Test 4: POI
```bash
curl "http://localhost:4000/api/rydinex-poi/nearby?latitude=40.7128&longitude=-74.0060&radius=1&limit=5"
```

### Test 5: Traffic
```bash
curl -X POST http://localhost:4000/api/rydinex-traffic/report -H "Content-Type: application/json" -d "{\"latitude\":40.7128,\"longitude\":-74.0060,\"speed\":35,\"driverId\":\"test\",\"accuracy\":100}"
```

### Test 6: Maps
```bash
curl "http://localhost:4000/api/rydinex-map-intelligence/speed-limit?latitude=40.7128&longitude=-74.0060"
```

---

**All 6 tests should return `{"success":true}` or similar** ✅

**See:** FOLLOW_THESE_STEPS_NOW.md for detailed guide
