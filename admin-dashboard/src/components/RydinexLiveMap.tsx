'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { io, type Socket } from 'socket.io-client';
import 'leaflet/dist/leaflet.css';

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.rydinex.com';

type MapLayer = 'street' | 'satellite';

type ActiveTrip = {
  tripId: string;
  driverId: string;
  riderId: string;
};

type NearbyPoi = {
  _id?: string;
  id?: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewCount?: number;
  address?: string;
  distance?: number;
  phoneNumber?: string;
  relevanceScore?: number;
};

type TripLocationUpdate = {
  tripId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
};

type TripEndedEvent = {
  tripId: string;
  driverId: string;
};

export default function RydinexLiveMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const poiMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const tileLayersRef = useRef<Partial<Record<MapLayer, L.TileLayer>>>({});
  const socketRef = useRef<Socket | null>(null);

  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<MapLayer>('street');
  const [showPOI, setShowPOI] = useState(true);
  const [poiCategory, setPoiCategory] = useState('all');
  const [nearbyPOI, setNearbyPOI] = useState<NearbyPoi[]>([]);

  const createPOIIcon = useCallback((category: string) => {
    const categorySymbols: Record<string, string> = {
      restaurant: 'R',
      gas_station: 'G',
      hospital: 'H',
      hotel: 'T',
      pharmacy: 'P',
      atm: 'A',
      parking: 'K',
      car_wash: 'C',
      bank: 'B',
      grocery: 'S',
      charging_station: 'E',
      emergency: '!',
      cafe: 'F',
      bar: 'D',
      other: 'O',
    };

    return L.divIcon({
      html: `
        <div style="
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          border: 2px solid #3388ff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          font-weight: 700;
        ">
          ${categorySymbols[category] || 'O'}
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
      className: '',
    });
  }, []);

  const createDriverIcon = useCallback((speed = 0) => {
    const speedColor = speed > 50 ? '#ff6b6b' : speed > 30 ? '#ffd93d' : '#6bcf7f';

    return L.divIcon({
      html: `
        <div style="
          background-color: ${speedColor};
          border: 2px solid white;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          D
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
      className: '',
    });
  }, []);

  const displayPOIMarkers = useCallback(
    (poiList: NearbyPoi[]) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      poiMarkersRef.current.forEach(marker => marker.remove());
      poiMarkersRef.current.clear();

      poiList.forEach(poi => {
        const markerKey = poi._id || poi.id || poi.name;
        const marker = L.marker([poi.latitude, poi.longitude], {
          icon: createPOIIcon(poi.category),
          title: poi.name,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: sans-serif; width: 240px;">
            <strong>${poi.name}</strong><br/>
            <small style="color: #666;">${poi.category.replace('_', ' ')}</small><br/>
            ${poi.rating ? `Rating: ${poi.rating.toFixed(1)} (${poi.reviewCount || 0} reviews)<br/>` : ''}
            ${poi.address ? `Address: ${poi.address}<br/>` : ''}
            ${poi.distance ? `Distance: ${(poi.distance * 1000).toFixed(0)}m<br/>` : ''}
            ${poi.phoneNumber ? `Phone: ${poi.phoneNumber}<br/>` : ''}
            <small style="color: #3388ff;">Relevance: ${Math.round(poi.relevanceScore || 0)}%</small>
          </div>
        `);

        poiMarkersRef.current.set(markerKey, marker);
      });
    },
    [createPOIIcon]
  );

  const fetchNearbyPOI = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const category = poiCategory !== 'all' ? poiCategory : null;
        const query = new URLSearchParams({
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          radius: '2',
          ...(category && { category }),
          limit: '15',
        });

        const response = await fetch(`${BACKEND_ORIGIN}/api/rydinex-poi/nearby?${query}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { data?: NearbyPoi[] };
        const poiList = payload.data || [];
        setNearbyPOI(poiList);
        displayPOIMarkers(poiList);
      } catch (error) {
        console.error('Error fetching POI:', error);
      }
    },
    [displayPOIMarkers, poiCategory]
  );

  const addToPolyline = useCallback((tripId: string, coords: [number, number]) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const existing = polylinesRef.current.get(tripId);
    if (existing) {
      existing.addLatLng(coords);
      return;
    }

    const polyline = L.polyline([coords], {
      color: '#3388ff',
      weight: 3,
      opacity: 0.8,
    }).addTo(map);

    polylinesRef.current.set(tripId, polyline);
  }, []);

  const handleLocationUpdate = useCallback(
    (data: TripLocationUpdate) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      const { tripId, driverId, latitude, longitude, speed } = data;

      if (showPOI && (!selectedTrip || selectedTrip === tripId)) {
        void fetchNearbyPOI(latitude, longitude);
      }

      const markerId = `driver-${driverId}`;
      const currentMarker = markersRef.current.get(markerId);

      if (!currentMarker) {
        const marker = L.marker([latitude, longitude], {
          icon: createDriverIcon(speed),
          title: `Driver: ${driverId}`,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: sans-serif; width: 200px;">
            <strong>Driver ${driverId}</strong><br/>
            Speed: ${speed?.toFixed(1) || 0} km/h<br/>
            Trip: ${tripId}
          </div>
        `);

        markersRef.current.set(markerId, marker);
      } else {
        currentMarker.setLatLng([latitude, longitude]);
        currentMarker.setIcon(createDriverIcon(speed));
      }

      addToPolyline(tripId, [latitude, longitude]);

      if (selectedTrip === tripId) {
        map.panTo([latitude, longitude]);
      }
    },
    [addToPolyline, createDriverIcon, fetchNearbyPOI, selectedTrip, showPOI]
  );

  const handleTripStarted = useCallback((data: ActiveTrip) => {
    setActiveTrips(prev => {
      if (prev.some(trip => trip.tripId === data.tripId)) {
        return prev;
      }
      return [...prev, data];
    });
  }, []);

  const handleTripEnded = useCallback((data: TripEndedEvent) => {
    setActiveTrips(prev => prev.filter(trip => trip.tripId !== data.tripId));
    markersRef.current.get(`driver-${data.driverId}`)?.remove();
    markersRef.current.delete(`driver-${data.driverId}`);
    polylinesRef.current.get(data.tripId)?.remove();
    polylinesRef.current.delete(data.tripId);
  }, []);

  const handleNearbyPOIs = useCallback(
    (data: NearbyPoi[]) => {
      setNearbyPOI(data);
      if (!showPOI) {
        return;
      }
      displayPOIMarkers(data.filter(poi => poiCategory === 'all' || poi.category === poiCategory));
    },
    [displayPOIMarkers, poiCategory, showPOI]
  );

  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current).setView([40.7128, -74.006], 13);

      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      });

      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '© Esri',
          maxZoom: 18,
        }
      );

      tileLayersRef.current = {
        street: streetLayer,
        satellite: satelliteLayer,
      };

      streetLayer.addTo(map);
      mapRef.current = map;
    }

    return () => {
      socketRef.current?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = io(BACKEND_ORIGIN, {
      path: '/socket.io/',
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to RydinexMaps');
    });
    socket.on('location-updated', handleLocationUpdate);
    socket.on('trip-started', handleTripStarted);
    socket.on('trip-ended', handleTripEnded);
    socket.on('nearby-pois', handleNearbyPOIs);

    return () => {
      socket.disconnect();
    };
  }, [handleLocationUpdate, handleNearbyPOIs, handleTripEnded, handleTripStarted]);

  function switchLayer(layer: MapLayer) {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    setMapLayer(layer);
    Object.values(tileLayersRef.current).forEach(tileLayer => {
      if (tileLayer) {
        map.removeLayer(tileLayer);
      }
    });
    tileLayersRef.current[layer]?.addTo(map);
  }

  function switchPOICategory(category: string) {
    setPoiCategory(category);
    socketRef.current?.emit('request-nearby-pois', { category });
    if (showPOI) {
      displayPOIMarkers(nearbyPOI.filter(poi => category === 'all' || poi.category === category));
    }
  }

  function togglePOIVisibility() {
    setShowPOI(prev => {
      const next = !prev;
      if (!next) {
        poiMarkersRef.current.forEach(marker => marker.remove());
      } else {
        displayPOIMarkers(nearbyPOI.filter(poi => poiCategory === 'all' || poi.category === poiCategory));
      }
      return next;
    });
  }

  function selectTrip(tripId: string) {
    setSelectedTrip(tripId);
    socketRef.current?.emit('request-location', { tripId });
  }

  function clearMap() {
    markersRef.current.forEach(marker => marker.remove());
    polylinesRef.current.forEach(polyline => polyline.remove());
    poiMarkersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
    polylinesRef.current.clear();
    poiMarkersRef.current.clear();
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system' }}>
      <div
        style={{
          width: '320px',
          backgroundColor: '#f8f9fa',
          borderRight: '1px solid #dee2e6',
          overflowY: 'auto',
          padding: '20px',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: '24px', fontWeight: 'bold' }}>
          RydinexMaps
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={clearMap}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Clear Map
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => switchLayer('street')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: mapLayer === 'street' ? '#3388ff' : 'white',
              color: mapLayer === 'street' ? 'white' : '#000',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Street View
          </button>
          <button
            onClick={() => switchLayer('satellite')}
            style={{
              width: '100%',
              padding: '10px',
              marginTop: '10px',
              backgroundColor: mapLayer === 'satellite' ? '#3388ff' : 'white',
              color: mapLayer === 'satellite' ? 'white' : '#000',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Satellite View
          </button>
        </div>

        <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #dee2e6' }}>
          <h3
            style={{
              margin: '0 0 10px',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            POI Intelligence
            <input type="checkbox" checked={showPOI} onChange={togglePOIVisibility} style={{ cursor: 'pointer' }} />
          </h3>

          {showPOI && (
            <div>
              <select
                value={poiCategory}
                onChange={event => switchPOICategory(event.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '8px',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6',
                  fontSize: '12px',
                }}
              >
                <option value="all">All Categories</option>
                <option value="restaurant">Restaurants</option>
                <option value="gas_station">Gas Stations</option>
                <option value="hospital">Hospitals</option>
                <option value="hotel">Hotels</option>
                <option value="pharmacy">Pharmacies</option>
                <option value="atm">ATM</option>
                <option value="parking">Parking</option>
                <option value="car_wash">Car Wash</option>
                <option value="charging_station">EV Charging</option>
                <option value="emergency">Emergency</option>
                <option value="cafe">Cafes</option>
              </select>

              {nearbyPOI.length > 0 && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                  <small style={{ fontWeight: '600' }}>Found {nearbyPOI.length} nearby:</small>
                  {nearbyPOI.slice(0, 5).map((poi, index) => (
                    <div key={`${poi._id || poi.id || poi.name}-${index}`} style={{ marginTop: '6px', paddingBottom: '6px', borderBottom: '1px solid #eee' }}>
                      <strong>{poi.name}</strong>
                      <br />
                      <small>
                        Rating {poi.rating?.toFixed(1) || '0.0'} | {Math.round(poi.relevanceScore || 0)}% match
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: '600' }}>
          Active Trips ({activeTrips.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeTrips.map(trip => (
            <button
              key={trip.tripId}
              onClick={() => selectTrip(trip.tripId)}
              style={{
                padding: '12px',
                backgroundColor: selectedTrip === trip.tripId ? '#3388ff' : 'white',
                color: selectedTrip === trip.tripId ? 'white' : '#000',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseOver={event => {
                event.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
              onMouseOut={event => {
                event.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontWeight: '600', fontSize: '14px' }}>Trip: {trip.tripId.slice(0, 8)}...</div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Driver: {trip.driverId.slice(0, 6)}...</div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Rider: {trip.riderId.slice(0, 6)}...</div>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={mapContainerRef}
        style={{
          flex: 1,
          position: 'relative',
        }}
      />

      {selectedTrip && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'white',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '240px',
            fontFamily: 'system-ui',
          }}
        >
          <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600' }}>Trip Stats</h4>
          <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span style={{ opacity: 0.6 }}>Distance:</span> <strong>0.0 km</strong>
            </div>
            <div>
              <span style={{ opacity: 0.6 }}>Duration:</span> <strong>0 min</strong>
            </div>
            <div>
              <span style={{ opacity: 0.6 }}>Avg Speed:</span> <strong>0.0 km/h</strong>
            </div>
            <div>
              <span style={{ opacity: 0.6 }}>Max Speed:</span> <strong>0.0 km/h</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
