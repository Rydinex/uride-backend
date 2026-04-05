import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../config/network';

const { width, height } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
}

type TrackingQuality = 'high' | 'medium' | 'low';

const MAX_ACCEPTABLE_ACCURACY_METERS = 120;
const SOFT_ACCURACY_THRESHOLD_METERS = 65;
const MAX_INFERRED_SPEED_KMH = 180;
const MAX_JUMP_DISTANCE_METERS = 250;
const POI_REFRESH_INTERVAL_MS = 12000;
const POI_REFRESH_DISTANCE_METERS = 120;
const MAX_POLYLINE_POINTS = 350;

function speedMpsToKph(speedMps?: number | null): number {
  if (!Number.isFinite(Number(speedMps)) || Number(speedMps) < 0) {
    return 0;
  }

  return Number(speedMps) * 3.6;
}

function haversineDistanceMeters(a: Pick<LocationData, 'latitude' | 'longitude'>, b: Pick<LocationData, 'latitude' | 'longitude'>): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getTrackingQuality(accuracy?: number | null): TrackingQuality {
  const resolvedAccuracy = Number.isFinite(Number(accuracy)) ? Number(accuracy) : MAX_ACCEPTABLE_ACCURACY_METERS;

  if (resolvedAccuracy <= 20) {
    return 'high';
  }

  if (resolvedAccuracy <= SOFT_ACCURACY_THRESHOLD_METERS) {
    return 'medium';
  }

  return 'low';
}

type RideCategory = 'black_car' | 'black_suv';

const POI_CATEGORY_ICONS: Record<string, string> = {
  restaurant: '🍽️',
  gas_station: '⛽',
  hotel: '🏨',
  pharmacy: '💊',
};

interface AirportPickupInstructions {
  operationType?: string;
  isAirportPickup?: boolean;
  airport?: {
    code: string;
    name: string;
  } | null;
  terminal?: string | null;
  pickupZone?: {
    code?: string;
    name?: string;
  } | null;
  pickupLane?: {
    code?: string;
    name?: string;
    message?: string;
  } | null;
  instructions?: string[];
}

interface RydinexMapProps {
  tripId: string;
  userId: string;
  userType: 'driver' | 'rider' | 'admin';
  backendUrl?: string;
  onLocationUpdate?: (location: LocationData) => void;
  initialMapType?: 'standard' | 'satellite' | 'hybrid';
  showPOI?: boolean;
  rideCategory?: RideCategory;
  enableAirportGuidance?: boolean;
}

export default function RydinexMap({
  tripId,
  userId,
  userType,
  backendUrl = BACKEND_URL,
  onLocationUpdate,
  initialMapType = 'standard',
  showPOI = true,
  rideCategory = 'black_car',
  enableAirportGuidance = true,
}: RydinexMapProps) {
  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<any>(null);
  const locationWatchRef = useRef<number | null>(null);
  const airportRefreshRef = useRef(0);
  const lastAcceptedLocationRef = useRef<LocationData | null>(null);
  const lastAcceptedTimestampRef = useRef(0);
  const lastPoiFetchRef = useRef(0);
  const lastPoiFetchLocationRef = useRef<LocationData | null>(null);

  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [driverLocation, setDriverLocation] = useState<LocationData | null>(null);
  const [polylinePoints, setPolylinePoints] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>(initialMapType);
  const [nearbyPOI, setNearbyPOI] = useState<any[]>([]);
  const [poiCategory, setPoiCategory] = useState('all');
  const [stats, setStats] = useState({
    distance: 0,
    duration: 0,
    avgSpeed: 0,
  });
  const [trackingQuality, setTrackingQuality] = useState<TrackingQuality>('medium');
  const [airportGuidance, setAirportGuidance] = useState<AirportPickupInstructions | null>(null);
  const [airportGuidanceError, setAirportGuidanceError] = useState('');

  const shouldRefreshPoi = useCallback((location: LocationData, now: number) => {
    if (now - lastPoiFetchRef.current >= POI_REFRESH_INTERVAL_MS) {
      return true;
    }

    if (!lastPoiFetchLocationRef.current) {
      return true;
    }

    return haversineDistanceMeters(lastPoiFetchLocationRef.current, location) >= POI_REFRESH_DISTANCE_METERS;
  }, []);

  const acceptAndSmoothLocation = useCallback((rawLocation: LocationData, now: number) => {
    const previous = lastAcceptedLocationRef.current;
    const resolvedAccuracy = Number.isFinite(Number(rawLocation.accuracy)) ? Number(rawLocation.accuracy) : MAX_ACCEPTABLE_ACCURACY_METERS;

    if (resolvedAccuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      return null;
    }

    if (!previous) {
      const firstAccepted = {
        ...rawLocation,
        speed: speedMpsToKph(rawLocation.speed),
      };

      lastAcceptedLocationRef.current = firstAccepted;
      lastAcceptedTimestampRef.current = now;
      return firstAccepted;
    }

    const timeDeltaSeconds = Math.max((now - lastAcceptedTimestampRef.current) / 1000, 1);
    const jumpDistanceMeters = haversineDistanceMeters(previous, rawLocation);
    const inferredSpeedKmh = (jumpDistanceMeters / timeDeltaSeconds) * 3.6;

    if (jumpDistanceMeters > MAX_JUMP_DISTANCE_METERS && inferredSpeedKmh > MAX_INFERRED_SPEED_KMH) {
      return null;
    }

    const smoothingAlpha = resolvedAccuracy <= 15 ? 0.82 : resolvedAccuracy <= 35 ? 0.62 : 0.45;
    const accepted = {
      latitude: previous.latitude + (rawLocation.latitude - previous.latitude) * smoothingAlpha,
      longitude: previous.longitude + (rawLocation.longitude - previous.longitude) * smoothingAlpha,
      accuracy: rawLocation.accuracy,
      speed: speedMpsToKph(rawLocation.speed),
      heading: rawLocation.heading,
      altitude: rawLocation.altitude,
    };

    lastAcceptedLocationRef.current = accepted;
    lastAcceptedTimestampRef.current = now;

    return accepted;
  }, []);

  const refreshAirportGuidance = useCallback(
    async (location: LocationData) => {
      if (!enableAirportGuidance || userType !== 'rider') {
        return;
      }

      const query = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        rideCategory,
      });

      try {
        const response = await fetch(`${backendUrl}/api/airport-queue/pickup-instructions?${query.toString()}`);
        const payload = await response.json().catch(() => ({}));

        if (response.status === 403) {
          setAirportGuidanceError(payload?.message || 'Pickup is not allowed from this area.');
          setAirportGuidance(null);
          return;
        }

        if (!response.ok) {
          throw new Error(payload?.message || 'Unable to fetch airport guidance.');
        }

        setAirportGuidance(payload);
        setAirportGuidanceError('');
      } catch (requestError: unknown) {
        const message = requestError instanceof Error ? requestError.message : 'Unable to fetch airport guidance.';
        setAirportGuidanceError(message);
      }
    },
    [backendUrl, enableAirportGuidance, rideCategory, userType]
  );

  // Request location permissions
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'RydinexMaps Location Permission',
            message: 'RydinexMaps needs access to your location for real-time tracking.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        Alert.alert('Error', 'Failed to request location permission');
        return false;
      }
    }

    return true;
  };

  // Initialize Socket.io connection
  useEffect(() => {
    const initSocket = async () => {
      try {
        socketRef.current = io(backendUrl, {
          path: '/socket.io/',
          reconnection: true,
          transports: ['websocket', 'polling'],
        });

        socketRef.current.on('connect', () => {
          console.log('[RydinexMap] Connected to server');
          socketRef.current.emit('join-trip', {
            tripId,
            userId,
            userType,
          });
        });

        socketRef.current.on('location-updated', (data: any) => {
          if (userType === 'rider' && data.driverId) {
            // Rider receives driver location
            setDriverLocation({
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: data.accuracy,
              speed: data.speed,
            });

            // Add to polyline
            setPolylinePoints(prev => [
              ...prev,
              {
                latitude: data.latitude,
                longitude: data.longitude,
              },
            ]);
          }
        });

        socketRef.current.on('trip-stats', (data: any) => {
          setStats(data.stats);
        });

        socketRef.current.on('error', (error: any) => {
          console.error('[RydinexMap] Socket error:', error);
          Alert.alert('Connection Error', error.message);
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize Socket.io:', error);
        Alert.alert('Error', 'Failed to connect to map service');
        setIsLoading(false);
      }
    };

    initSocket();

    return () => {
      socketRef.current?.emit('leave-trip', { tripId });
      socketRef.current?.disconnect();
    };
  }, [tripId, userId, userType, backendUrl]);

  // Start location tracking
  useEffect(() => {
    const startLocationTracking = async () => {
      const hasPermission = await requestLocationPermission();

      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Location permission is required for this feature');
        return;
      }

      // Get current location first
      Geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude, accuracy, altitude } = position.coords;
          const seededLocation = { latitude, longitude, accuracy, altitude, speed: 0, heading: null };
          const now = Date.now();
          const location = acceptAndSmoothLocation(seededLocation, now) || seededLocation;

          setCurrentLocation(location);
          setPolylinePoints([location]);
          setTrackingQuality(getTrackingQuality(location.accuracy));
          refreshAirportGuidance(location);

          // Pan to current location
          mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        },
        error => {
          console.error('Error getting location:', error);
          Alert.alert('Location Error', 'Failed to get your current location');
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 1000,
        }
      );

      // Watch position for updates
      locationWatchRef.current = Geolocation.watchPosition(
        position => {
          const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
          const rawLocation = { latitude, longitude, accuracy, speed, heading, altitude };
          const now = Date.now();
          const location = acceptAndSmoothLocation(rawLocation, now);

          if (!location) {
            return;
          }

          setCurrentLocation(location);
          setTrackingQuality(getTrackingQuality(location.accuracy));
          onLocationUpdate?.(location);

          setPolylinePoints(prev => {
            const next = [...prev, { latitude: location.latitude, longitude: location.longitude }];
            if (next.length > MAX_POLYLINE_POINTS) {
              return next.slice(next.length - MAX_POLYLINE_POINTS);
            }

            return next;
          });

          // Fetch nearby POI periodically
          if (userType === 'rider' && showPOI && shouldRefreshPoi(location, now)) {
            lastPoiFetchRef.current = now;
            lastPoiFetchLocationRef.current = location;
            fetchNearbyPOI(latitude, longitude);
          }

          if (enableAirportGuidance && userType === 'rider' && now - airportRefreshRef.current > 12000) {
            airportRefreshRef.current = now;
            refreshAirportGuidance(location);
          }

          // Emit to backend
          if (userType === 'driver') {
            socketRef.current?.emit('location-update', {
              tripId,
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy,
              speed: location.speed,
              speedKph: location.speed,
              heading,
              altitude,
            });
          }
        },
        error => {
          console.error('Error watching position:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 1000,
          distanceFilter: 10, // Update every 10 meters
        }
      );
    };

    startLocationTracking();

    return () => {
      if (locationWatchRef.current !== null) {
        Geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, [acceptAndSmoothLocation, enableAirportGuidance, onLocationUpdate, refreshAirportGuidance, shouldRefreshPoi, showPOI, tripId, userType]);

  // Fetch nearby POI
  const fetchNearbyPOI = async (latitude: number, longitude: number) => {
    if (!showPOI) return;

    try {
      const category = poiCategory !== 'all' ? poiCategory : '';
      const query = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: '1.5',
        ...(category && { category }),
        limit: '8',
      });

      const response = await fetch(
        `${backendUrl}/api/rydinex-poi/nearby?${query}`,
        {}
      );

      if (response.ok) {
        const data = await response.json();
        setNearbyPOI(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching POI:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3388ff" />
        <Text style={styles.loadingText}>Initializing RydinexMap...</Text>
      </View>
    );
  }

  const mapRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;

  return (
    <View style={styles.container}>
      {mapRegion && (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation
          followsUserLocation
          mapType={mapType}
        >
          {/* Current user location */}
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title={userType === 'driver' ? 'Your Location' : 'Your Location'}
              pinColor={userType === 'driver' ? '#3388ff' : '#6bcf7f'}
            />
          )}

          {/* Driver location (for rider view) */}
          {userType === 'rider' && driverLocation && (
            <Marker
              coordinate={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              }}
              title="Driver"
              pinColor="#ff6b6b"
            />
          )}

          {/* Trip polyline */}
          {polylinePoints.length > 1 && (
            <Polyline
              coordinates={polylinePoints.map(p => ({
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
              strokeColor="#3388ff"
              strokeWidth={3}
              geodesic
            />
          )}

          {/* Nearby POI markers */}
          {showPOI && userType === 'rider' && nearbyPOI.map((poi, idx) => {
            return (
              <Marker
                key={idx}
                coordinate={{
                  latitude: poi.latitude,
                  longitude: poi.longitude,
                }}
                title={poi.name}
                description={`${poi.category.replace('_', ' ')} • ⭐ ${poi.rating?.toFixed(1) || 'N/A'}`}
                pinColor="#FF6B9D"
              />
            );
          })}
        </MapView>
      )}

      {/* Map Type Switcher */}
      {enableAirportGuidance && userType === 'rider' && (
        <View style={styles.airportGuidanceCard}>
          <Text style={styles.airportGuidanceTitle}>Airport Pickup Guidance</Text>
          <Text style={styles.airportGuidanceMeta}>Category: {rideCategory === 'black_suv' ? 'Black SUV' : 'Black Car'}</Text>

          {airportGuidance?.isAirportPickup ? (
            <>
              <Text style={styles.airportGuidanceMeta}>
                {airportGuidance.airport?.code || 'Airport'} {airportGuidance.terminal ? `- ${airportGuidance.terminal}` : ''}
              </Text>
              <Text style={styles.airportGuidanceMeta}>Pickup Zone: {airportGuidance.pickupZone?.name || '-'}</Text>
              <Text style={styles.airportGuidanceMeta}>Lane: {airportGuidance.pickupLane?.name || '-'}</Text>
              {Array.isArray(airportGuidance.instructions) && airportGuidance.instructions.length > 0 ? (
                <Text style={styles.airportGuidanceHint}>Tip: {airportGuidance.instructions[0]}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.airportGuidanceHint}>No airport-specific pickup restrictions at your current location.</Text>
          )}

          {airportGuidanceError ? <Text style={styles.airportGuidanceError}>{airportGuidanceError}</Text> : null}
        </View>
      )}

      <View style={styles.mapTypeContainer}>
        {(['standard', 'satellite', 'hybrid'] as const).map(type => (
          <Text
            key={type}
            style={[
              styles.mapTypeButton,
              mapType === type && styles.mapTypeButtonActive,
            ]}
            onPress={() => setMapType(type)}
          >
            {type === 'standard' && '🗺️'}
            {type === 'satellite' && '🛰️'}
            {type === 'hybrid' && '📍'}
          </Text>
        ))}
      </View>

      {/* POI Category Selector */}
      {showPOI && userType === 'rider' && (
        <View style={styles.poiCategoryContainer}>
          <Text style={styles.poiLabel}>POI: {nearbyPOI.length} nearby</Text>
          <View style={styles.categoryScroll}>
            {['restaurant', 'gas_station', 'hotel', 'pharmacy'].map(category => (
              <Text
                key={category}
                style={[
                  styles.categoryTag,
                  poiCategory === category && styles.categoryTagActive,
                ]}
                onPress={() => setPoiCategory(category === poiCategory ? 'all' : category)}
              >
                {POI_CATEGORY_ICONS[category] || '📍'}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Stats overlay */}
      {userType === 'rider' && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Trip Info</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Distance:</Text>
            <Text style={styles.statValue}>{stats.distance.toFixed(2)} km</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Duration:</Text>
            <Text style={styles.statValue}>{stats.duration} min</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Avg Speed:</Text>
            <Text style={styles.statValue}>{stats.avgSpeed.toFixed(1)} km/h</Text>
          </View>
        </View>
      )}

      {/* Current speed display for driver */}
      {userType === 'driver' && currentLocation && (
        <View style={styles.speedContainer}>
          <Text style={styles.speedValue}>{Math.max(0, currentLocation.speed || 0).toFixed(0)}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
          <Text style={styles.trackingQualityText}>GPS {trackingQuality}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  mapTypeContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 4,
  },
  airportGuidanceCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 76,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  airportGuidanceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  airportGuidanceMeta: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },
  airportGuidanceHint: {
    marginTop: 3,
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
  },
  airportGuidanceError: {
    marginTop: 4,
    fontSize: 12,
    color: '#b91c1c',
  },
  mapTypeButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#3388ff',
    fontWeight: '500',
  },
  mapTypeButtonActive: {
    backgroundColor: '#3388ff',
    color: 'white',
    fontWeight: 'bold',
  },
  poiCategoryContainer: {
    position: 'absolute',
    top: height * 0.2,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  poiLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  categoryScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxHeight: 120,
    overflow: 'hidden',
  },
  categoryTag: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f4f4f4',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
    fontSize: 14,
    color: '#3388ff',
    fontWeight: '500',
  },
  categoryTagActive: {
    backgroundColor: '#3388ff',
    color: 'white',
    fontWeight: 'bold',
  },
  statsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsTitle: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  speedContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#3388ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  speedValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  speedUnit: {
    fontSize: 12,
    color: 'white',
    marginTop: 2,
  },
  trackingQualityText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
  },
});
