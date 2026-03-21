# 🎯 RydinexMaps AI POI Intelligence System

**Complete Points of Interest (POI) database with AI-powered recommendations**

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Database Models](#database-models)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [AI Intelligence](#ai-intelligence)
- [Setup & Configuration](#setup--configuration)
- [Frontend Integration](#frontend-integration)

---

## 🎯 Features

### ✨ Core Features
- 🎯 **Geospatial Search** - Find POI near any location (2dsphere indexes)
- 🤖 **AI Relevance Scoring** - Smart ranking based on ratings, popularity, reviews
- 📍 **15+ Categories** - Restaurants, gas, hospitals, hotels, pharmacies, etc.
- 🛣️ **Route Recommendations** - Smart POI suggestions along driver route
- 🚨 **Emergency Services** - Priority emergency hospital/police locations
- 🔍 **Full-Text Search** - Search POI by name, address, tags
- ⭐ **Ratings & Reviews** - User feedback integration
- 📊 **Analytics** - Track POI visits and popularity
- 🏷️ **Smart Tags** - Categorize POI (wifi, parking, outdoor seating, etc.)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│               Admin Dashboard / Mobile Apps             │
│          (RydinexLiveMap, RydinexMap components)       │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
    ┌─────▼─────┐        ┌─────▼─────┐
    │ REST API  │        │ Socket.io │
    │ Endpoints │        │  Events   │
    └─────┬─────┘        └─────┬─────┘
          │                     │
    ┌─────▼──────────────────────┴─────┐
    │   RydinexAIPoiService             │
    │  (AI Scoring & Logic)             │
    └─────┬──────────────────────────────┘
          │
    ┌─────▼──────────────────────────────┐
    │   MongoDB POI Collection            │
    │  (Geospatial Indexes)              │
    │  - location: 2dsphere              │
    │  - category: indexed               │
    │  - name: text indexed              │
    └──────────────────────────────────────┘
```

---

## 🗄️ Database Models

### POI Schema

```javascript
{
  _id: ObjectId,
  
  // Basic Info
  name: String,                    // POI name (indexed)
  category: String,                // ['restaurant', 'gas_station', 'hospital', ...]
  address: String,
  phoneNumber: String,
  website: String,
  
  // Location
  latitude: Number,
  longitude: Number,
  location: {                       // Geospatial index for proximity queries
    type: 'Point',
    coordinates: [longitude, latitude]
  },
  
  // Ratings & Reviews
  rating: Number (0-5),            // Average rating
  reviewCount: Number,
  priceLevel: Number (1-4),        // $ to $$$$
  
  // Business Info
  isOpen: Boolean,
  operatingHours: {
    monday: { open: '09:00', close: '22:00' },
    // ... other days
  },
  
  // AI & Analytics
  aiRelevanceScore: Number (0-100), // Calculated from rating + visits + reviews
  aiTags: [String],                 // ['recommended', 'popular', 'new', 'emergency', 'premium']
  visits: Number,                   // Tracked for popularity
  tags: [String],                   // ['wifi', 'parking', 'outdoor_seating']
  imageUrl: String,
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  lastUpdated: Date
}
```

---

## 🔗 API Endpoints

### 1. Find Nearby POI
```bash
GET /api/rydinex-poi/nearby?latitude=40.7128&longitude=-74.0060&radius=2&category=restaurant&limit=10
```

**Query Parameters:**
- `latitude` (required) - User latitude
- `longitude` (required) - User longitude  
- `radius` (default: 2 km) - Search radius in kilometers
- `category` (optional) - Filter by category
- `minRating` (default: 0) - Minimum rating filter
- `limit` (default: 10) - Max results

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "poi_123",
      "name": "The Pasta House",
      "category": "restaurant",
      "latitude": 40.758,
      "longitude": -73.9855,
      "rating": 4.7,
      "distance": 0.45,
      "relevanceScore": 85,
      "aiTags": ["recommended", "popular"]
    }
  ]
}
```

---

### 2. Get Route Recommendations
```bash
POST /api/rydinex-poi/route-recommendations
Content-Type: application/json

{
  "routePoints": [
    [40.7128, -74.0060],
    [40.7580, -73.9855],
    [40.7614, -73.9776]
  ],
  "preferences": {
    "categories": ["restaurant"],
    "maxDistance": 0.5,
    "minRating": 3.5,
    "limit": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "name": "Sushi Paradise",
      "category": "restaurant",
      "rating": 4.8,
      "routeDistance": 0.32,
      "relevanceScore": 92,
      "reason": "Highly rated • Recommended"
    }
  ]
}
```

---

### 3. Search POI
```bash
GET /api/rydinex-poi/search?search=burger&latitude=40.7128&longitude=-74.0060&radius=5&limit=10
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "name": "Burger Palace",
      "distance": 0.62,
      "rating": 4.3
    }
  ]
}
```

---

### 4. Get POI by Category
```bash
GET /api/rydinex-poi/category/gas_station?latitude=40.7128&longitude=-74.0060&radius=3&limit=5
```

**Valid Categories:**
- `restaurant` - 🍽️
- `gas_station` - ⛽
- `hospital` - 🏥
- `hotel` - 🏨
- `pharmacy` - 💊
- `atm` - 🏧
- `parking` - 🅿️
- `car_wash` - 🚗
- `bank` - 🏦
- `grocery` - 🛒
- `charging_station` - 🔌
- `emergency` - 🚨
- `cafe` - ☕
- `bar` - 🍹
- `other` - 📍

---

### 5. Get Emergency Services
```bash
GET /api/rydinex-poi/emergency?latitude=40.7128&longitude=-74.0060&radius=5
```

**Returns:** Nearby hospitals, police, fire stations prioritized by distance

---

### 6. Log POI Visit
```bash
POST /api/rydinex-poi/visit
Content-Type: application/json

{
  "poiId": "poi_123"
}
```

**Purpose:** Analytics tracking for popularity scoring

---

## 💡 Usage Examples

### Frontend: Admin Dashboard
```typescript
// Show nearby POI on admin dashboard
const fetchNearbyPOI = async (latitude, longitude) => {
  const response = await fetch(
    `/api/rydinex-poi/nearby?latitude=${latitude}&longitude=${longitude}&radius=2&limit=15`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const data = await response.json();
  displayPOIMarkers(data.data);
};
```

### Frontend: Rider App
```typescript
// Show POI recommendations during ride
<RydinexMap
  tripId="trip_123"
  userId="rider_456"
  userType="rider"
  showPOI={true}
/>
```

### Backend: Seed Initial Data
```bash
# Run POI seeding script
cd backend
node scripts/seedPOI.js
```

---

## 🤖 AI Intelligence System

### Relevance Score Calculation

The AI system scores POI on multiple factors:

```javascript
score = 0

// Rating weight (0-40 points)
score += (poi.rating / 5) * 40

// Popularity weight (0-30 points)  
score += min((poi.visits / 1000) * 30, 30)

// Review count weight (0-20 points)
score += min((poi.reviewCount / 100) * 20, 20)

// AI tags bonus (0-10 points)
if (aiTags.includes('recommended')) score += 8
if (aiTags.includes('popular')) score += 5
if (aiTags.includes('emergency')) score += 10

// Price level modifier
if (priceLevel === 1) score += 2  // Budget boost

// Final score (0-100)
return min(score, 100)
```

### Recommendation Reasons

The system generates human-readable recommendation reasons:
- "Highly rated" (rating ≥ 4.5)
- "Popular" (high visit count)
- "Recommended" (admin tagged)
- "Budget-friendly" (price level 1)
- "New" (recently added)

---

## 🔧 Setup & Configuration

### 1. Install Dependencies
```bash
cd backend
npm install mongoose ioredis  # Already installed
```

### 2. Create MongoDB Indexes

The POI model automatically creates these indexes:

```javascript
// Geospatial index for proximity queries
location: { type: 'Point' } // 2dsphere

// Compound index for efficient filtering
category: 1, isOpen: 1, rating: -1

// Text index for search
name: 'text', address: 'text', tags: 'text'
```

### 3. Seed Sample Data
```bash
node backend/scripts/seedPOI.js
```

**Output:**
```
✅ Connected to MongoDB
🗑️  Deleted 0 existing POI
✅ Successfully seeded 13 POI
📍 Database indexes: ['_id_', 'location_2dsphere', 'category_1_isOpen_1_rating_-1', ...]
🎉 POI database seeded successfully!
```

### 4. Environment Variables
```env
# In .env
MONGO_URI=mongodb://localhost:27017/uride
```

---

## 🎨 Frontend Integration

### Admin Dashboard Features

The admin dashboard (`RydinexLiveMap.tsx`) includes:

```typescript
// POI visibility toggle
showPOI: boolean

// Category filter
poiCategory: 'all' | 'restaurant' | 'gas_station' | ...

// Nearby POI list
nearbyPOI: Array<POI>

// Auto-fetch POI on driver location update
if (showPOI) fetchNearbyPOI(latitude, longitude)
```

**UI Controls:**
- ✅/❌ Enable/disable POI display
- 🎯 Category selector dropdown
- 📊 POI list showing top results
- 🗺️ Interactive markers with details

### Mobile App Features

**Rider App (`RydinexMap.tsx`)**
- Real-time POI markers on map
- POI category quick-select buttons
- POI description in marker popups
- Auto-refresh nearby POI

**Driver App**
- Can toggle POI visibility
- Route-based recommendations
- Emergency service alerts

---

## 📊 Analytics & Reporting

### Track POI Visits
```javascript
// Log when user interacts with POI
await rydinexAIPoiService.logPOIVisit(poiId, userId);

// Updates visit count for popularity scoring
POI.visits += 1
```

### Popular POI Report
```javascript
// Get most visited POI
const popular = await POI.find()
  .sort({ visits: -1 })
  .limit(10);
```

---

## 🚀 Performance Optimization

### Geospatial Index Benefits
- Fast proximity queries
- Efficient radius searches
- Automatic distance calculation
- Supports spherical geometry

### Query Optimization
```javascript
// Efficiently find nearby + highly rated
db.pois.find({
  location: { $near: { $geometry: {...}, $maxDistance: 2000 } },
  rating: { $gte: 4 },
  isOpen: true
}).limit(10)

// Uses compound index: category_1_isOpen_1_rating_-1
```

---

## 🔐 Security

All POI endpoints require:
- ✅ JWT authentication token
- ✅ Rate limiting (240 requests/minute)
- ✅ CORS protection
- ✅ Input validation

---

## 📱 API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/nearby` | GET | Find POI near coordinates |
| `/route-recommendations` | POST | Get recommendations along route |
| `/search` | GET | Full-text search POI |
| `/category/:category` | GET | Get POI by category |
| `/emergency` | GET | Get emergency services |
| `/visit` | POST | Log POI visit |

---

## 🎓 Examples

### Example 1: Find Nearby Restaurants
```bash
curl -X GET 'http://localhost:4000/api/rydinex-poi/nearby?latitude=40.7128&longitude=-74.0060&radius=1&category=restaurant' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### Example 2: Route Recommendations
```bash
curl -X POST 'http://localhost:4000/api/rydinex-poi/route-recommendations' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "routePoints": [[40.7128, -74.0060], [40.7580, -73.9855]],
    "preferences": {"categories": ["restaurant"], "minRating": 4}
  }'
```

---

## 🐛 Troubleshooting

**Issue: POI not appearing**
- Check `showPOI` is enabled
- Verify geolocation coordinates
- Ensure POI database is seeded

**Issue: Slow queries**
- Verify MongoDB indexes are created
- Check database connection
- Monitor query performance

**Issue: Relevance scores are low**
- Ensure POI have rating and review data
- Increase visit tracking
- Update aiTags manually if needed

---

## 📈 Future Enhancements

- 🤖 Machine learning for personalized recommendations
- 📸 User-generated photos and reviews
- ⏰ Real-time operating hours updates
- 🎁 Deal/coupon integration
- 👥 Social recommendations from friends
- 🌍 Multiple language support

---

**🎉 POI Intelligence system is ready!**

Start using it by enabling `showPOI=true` in your components. 🚀
