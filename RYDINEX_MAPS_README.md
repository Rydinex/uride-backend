# 🗺️ RydinexMaps - Free GPS Service

A complete, production-ready GPS tracking service integrated across driver app, rider app, and admin dashboard. Built entirely with free, open-source technologies.

## Features

### 🚗 Real-Time Location Tracking
- Live driver location updates every 5-10 seconds
- WebSocket-based real-time broadcast
- Location history with polylines
- Speed, heading, and accuracy tracking

### 📊 Trip Analytics
- Total distance traveled
- Trip duration
- Average & maximum speed
- Location point history

### 🗺️ Beautiful Maps
- **Admin Dashboard**: Leaflet + OpenStreetMap (free)
- **Mobile Apps**: React Native Maps
- Live driver/rider visualization
- Trip polyline visualization
- Geofencing & zone management

### ⚡ Performance
- Redis GEO indexes for spatial queries
- MongoDB with TTL for location history
- Efficient polyline compression
- Socket.io namespaces for scalability

### 🔒 Security
- JWT authentication on all endpoints
- Rate limiting
- CORS protection
- Secure WebSocket connections

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RydinexMaps                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Backend Services                                        │
│  ├─ Location History (MongoDB)                          │
│  ├─ Real-time Tracking (Socket.io)                      │
│  ├─ Distance/ETA Calculations                           │
│  └─ Geofencing & Zones                                  │
│                                                           │
│  APIs                                                    │
│  ├─ /api/rydinex-maps/location/record                   │
│  ├─ /api/rydinex-maps/trip/:tripId/polyline             │
│  ├─ /api/rydinex-maps/trip/:tripId/stats                │
│  └─ /api/rydinex-maps/calculate                         │
│                                                           │
│  Real-Time (Socket.io /rydinex-maps)                    │
│  ├─ join-trip                                            │
│  ├─ location-update                                      │
│  ├─ location-updated (broadcast)                         │
│  └─ trip-stats                                           │
│                                                           │
│  UI Components                                           │
│  ├─ Admin: RydinexLiveMap (Next.js + Leaflet)           │
│  ├─ Driver: RydinexMap (React Native + Maps)            │
│  └─ Rider: RydinexMap (React Native + Maps)             │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Backend Setup

### 1. Install Dependencies
```bash
npm install leaflet leaflet-routing-machine
npm install ioredis mongoose socket.io
```

### 2. Models Created
- `LocationHistory.js` - Store location points with TTL
- `RydinexMap.js` - Geofences and zones

### 3. Services Created
- `rydinexMapsService.js` - Core GPS logic
  - recordLocation()
  - getTripPolyline()
  - calculateDistance()
  - estimateETA()
  - getTripStats()

### 4. Socket Handlers
- `rydinexMapsSocket.js` - Real-time location broadcast
  - join-trip
  - location-update
  - get-trip-stats
  - leave-trip

### 5. API Endpoints

#### Record Location
```bash
POST /api/rydinex-maps/location/record
Authorization: Bearer <token>
Content-Type: application/json

{
  "tripId": "trip_123",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "accuracy": 5,
  "speed": 25.5,
  "heading": 180,
  "altitude": 10
}
```

#### Get Trip Polyline
```bash
GET /api/rydinex-maps/trip/{tripId}/polyline
Authorization: Bearer <token>
```

#### Get Trip Stats
```bash
GET /api/rydinex-maps/trip/{tripId}/stats
Authorization: Bearer <token>
```

#### Calculate Distance & ETA
```bash
POST /api/rydinex-maps/calculate
Content-Type: application/json

{
  "lat1": 40.7128,
  "lon1": -74.0060,
  "lat2": 40.7580,
  "lon2": -73.9855,
  "speedKmh": 50
}
```

## Mobile App Integration

### Driver App (React Native)
```tsx
import RydinexMap from './components/RydinexMap';

export default function DriverTrip({ tripId, driverId }) {
  return (
    <RydinexMap
      tripId={tripId}
      userId={driverId}
      userType="driver"
      backendUrl="https://your-backend.com"
      onLocationUpdate={(location) => {
        console.log('Location updated:', location);
      }}
    />
  );
}
```

### Rider App (React Native)
```tsx
import RydinexMap from './components/RydinexMap';

export default function RiderTrip({ tripId, riderId }) {
  return (
    <RydinexMap
      tripId={tripId}
      userId={riderId}
      userType="rider"
      backendUrl="https://your-backend.com"
    />
  );
}
```

Features:
- Automatic location tracking (driver sends, rider receives)
- Beautiful map with trip polyline
- Real-time speed display
- Trip statistics overlay

## Admin Dashboard

### Live Map View
```tsx
import RydinexLiveMap from '@/components/RydinexLiveMap';

export default function AdminDashboard() {
  return <RydinexLiveMap />;
}
```

Features:
- **Left Sidebar**: Active trips list
- **Center Map**: Live driver locations with color-coded speed
- **Bottom Right**: Trip statistics
- **Real-time Updates**: WebSocket broadcast

Color coding:
- 🟢 Green: Slow (<30 km/h)
- 🟡 Yellow: Medium (30-50 km/h)
- 🔴 Red: Fast (>50 km/h)

## Installation Steps

### 1. Backend
```bash
cd backend
npm install
# Models, services, and routes already added
node app.js
```

### 2. Driver App
```bash
cd driver-app/DriverApp
npm install
# RydinexMap component ready to use
# Update your trip screens to import RydinexMap
```

### 3. Rider App
```bash
cd rider-app/RiderApp
npm install
# RydinexMap component ready to use
```

### 4. Admin Dashboard
```bash
cd admin-dashboard
npm install leaflet leaflet-routing-machine
# RydinexLiveMap component ready to use
# Import in your dashboard page
```

## Configuration

### Environment Variables
```env
# Backend
MONGO_URI=mongodb://localhost:27017/rydinex
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
PORT=4000

# Mobile Apps
REACT_NATIVE_BACKEND_URL=https://your-backend.com
```

## Database Setup

### MongoDB Collections
- `locationhistories` - Location points (auto-deleted after 30 days)
- `rydinexmaps` - Geofences and zones
- `trips` - Trip records (existing)

### Redis Keys
```
rydinex:active_trips          # Set of active trip IDs
rydinex:trip:locations:{id}   # Cached last location
rydinex:trip:polyline:{id}    # GEO polyline
```

## Performance Considerations

### Scalability
- Redis pub/sub for multi-server broadcast
- MongoDB TTL indexes for automatic cleanup
- WebSocket connection pooling
- Location batching for high-frequency updates

### Optimization
- Polyline simplification (Ramer-Douglas-Peucker algorithm ready)
- Delta compression for location updates
- Geospatial indexing on MongoDB

## Free Technologies Used

✅ **Database**: MongoDB (free tier available)  
✅ **Cache**: Redis (self-hosted or free tier)  
✅ **Maps**: OpenStreetMap (Leaflet)  
✅ **Real-time**: Socket.io  
✅ **Mobile**: React Native with react-native-maps  
✅ **Admin**: Next.js with Leaflet  
✅ **Server**: Node.js + Express  

**Total Cost**: $0 (if self-hosted)

## Next Steps

1. ✅ Install dependencies in all apps
2. ✅ Update Trip model to reference LocationHistory
3. ✅ Integrate RydinexMap component into trip screens
4. ✅ Deploy backend with location endpoints
5. ✅ Test with real devices
6. ✅ Enable background location for driver app
7. ✅ Add offline support with local SQLite cache

## Support

For issues or questions, create an issue in the repository or contact the development team.

---

**Built with ❤️ for RydinexMaps**
