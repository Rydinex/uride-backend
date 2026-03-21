import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  NativeModules,
  AsyncStorage,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { io } from 'socket.io-client';

const { width, height } = Dimensions.get('window');
const MANUAL_BACKEND_HOST = '10.0.0.70';
const resolveDevBackendHost = () => {
  const manualHost = MANUAL_BACKEND_HOST.trim();
  if (manualHost) {
    return manualHost;
  }

  // On physical devices, Metro scriptURL usually contains the host machine LAN IP.
  const scriptURL = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL || '';
  const scriptHostMatch = scriptURL.match(/^https?:\/\/([^/:]+)/i);
  const scriptHost = scriptHostMatch?.[1]?.trim();

  if (scriptHost && scriptHost !== 'localhost' && scriptHost !== '127.0.0.1') {
    return scriptHost;
  }

  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

const DEFAULT_BACKEND_HOST = resolveDevBackendHost();

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

interface RydinexMapProps {
  tripId: string;
  userId: string;
  userType: 'driver' | 'rider' | 'admin';
  backendUrl?: string;
  onLocationUpdate?: (location: LocationData) => void;
  initialMapType?: 'standard' | 'satellite' | 'hybrid';
  showPOI?: boolean;
}

export default function RydinexMap({
  tripId,
  userId,
  userType,
  backendUrl = `http://${DEFAULT_BACKEND_HOST}:4000`,
  onLocationUpdate,
  initialMapType = 'standard',
  showPOI = true,
}: RydinexMapProps) {
  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<any>(null);
  const locationWatchRef = useRef<number | null>(null);

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
          const location = { latitude, longitude, accuracy, altitude };

          setCurrentLocation(location);
          setPolylinePoints([location]);

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
          const location = { latitude, longitude, accuracy, speed, heading, altitude };

          setCurrentLocation(location);
          onLocationUpdate?.(location);

          // Fetch nearby POI periodically
          if (userType === 'rider' && showPOI) {
            fetchNearbyPOI(latitude, longitude);
          }

          // Emit to backend
          if (userType === 'driver') {
            socketRef.current?.emit('location-update', {
              tripId,
              latitude,
              longitude,
              accuracy,
              speed,
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
  }, [tripId, userType, onLocationUpdate]);

  // Fetch nearby POI
  const fetchNearbyPOI = async (latitude: number, longitude: number) => {
    if (!showPOI) return;

    try {
      const token = await AsyncStorage.getItem('authToken');
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
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
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
            const categoryEmojis: any = {
              restaurant: '🍽️',
              gas_station: '⛽',
              hospital: '🏥',
              hotel: '🏨',
              pharmacy: '💊',
              atm: '🏧',
              parking: '🅿️',
              car_wash: '🚗',
              charging_station: '🔌',
              emergency: '🚨',
              cafe: '☕',
            };

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
                {{
                  restaurant: '🍽️',
                  gas_station: '⛽',
                  hotel: '🏨',
                  pharmacy: '💊',
                }[category as any]}
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
          <Text style={styles.speedValue}>{(currentLocation.speed || 0).toFixed(0)}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
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
});
