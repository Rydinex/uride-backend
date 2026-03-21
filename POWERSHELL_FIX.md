# ✅ **POWERSHELL FIX - USE THESE COMMANDS**

## 🔧 The Problem

PowerShell doesn't use `&&` - that's a bash command.

## ✅ Solution: Use These Commands Instead

---

## **TERMINAL 1: Start Backend**

You're already in the backend folder, so just paste:

```powershell
npm start
```

That's it! Just press Enter.

**Wait for:**
```
MongoDB connected
Server running on port 4000
```

---

## **TERMINAL 2: Start Admin Dashboard**

Open a NEW PowerShell window and paste:

```powershell
cd admin-dashboard; npm run dev
```

Press Enter

**Wait for:**
```
Local: http://localhost:3000
```

---

## **TERMINAL 3: Run Tests**

Open a NEW PowerShell window and paste each test one at a time:

### Test 1: GPS
```powershell
curl -X POST http://localhost:4000/api/rydinex-maps/location/record -H "Content-Type: application/json" -d "{`"driverId`":`"test`",`"latitude`":40.7128,`"longitude`":-74.0060,`"speed`":45,`"accuracy`":10}"
```

### Test 2: Routing
```powershell
curl -X POST http://localhost:4000/api/rydinex-routing/calculate -H "Content-Type: application/json" -d "{`"waypoints`":[{`"latitude`":40.7128,`"longitude`":-74.0060},{`"latitude`":40.7580,`"longitude`":-73.9855}]}"
```

### Test 3: Geocoding
```powershell
curl -X POST http://localhost:4000/api/rydinex-geocoding/geocode -H "Content-Type: application/json" -d "{`"address`":`"Times Square`"}"
```

### Test 4: POI
```powershell
curl "http://localhost:4000/api/rydinex-poi/nearby?latitude=40.7128&longitude=-74.0060&radius=1&limit=5"
```

### Test 5: Traffic
```powershell
curl -X POST http://localhost:4000/api/rydinex-traffic/report -H "Content-Type: application/json" -d "{`"latitude`":40.7128,`"longitude`":-74.0060,`"speed`":35,`"driverId`":`"test`",`"accuracy`":100}"
```

### Test 6: Maps
```powershell
curl "http://localhost:4000/api/rydinex-map-intelligence/speed-limit?latitude=40.7128&longitude=-74.0060"
```

---

## 🌐 **Browser**

Open browser and go to:
```
http://localhost:3000
```

---

## ✅ **Expected Results**

All tests should return JSON with `"success":true` or similar data.

If you see that: **YOUR APP IS WORKING!** 🎉

---

## 📝 **Key Points for PowerShell**

| Task | Bash | PowerShell |
|------|------|-----------|
| Run two commands | `cmd1 && cmd2` | `cmd1; cmd2` |
| String with quotes | `"string"` | `` `"string`" `` |
| Already in folder | `cd folder && npm start` | `npm start` (if already there) |

---

**Now try again with these commands!** 🚀
