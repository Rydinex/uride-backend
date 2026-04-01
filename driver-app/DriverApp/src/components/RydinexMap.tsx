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
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

type RideCategory = 'black_car' | 'black_suv';

interface QueueEntrySnapshot {
  queueType?: string;
  airportCode?: string | null;
  eventCode?: string | null;
  status?: string;
  position?: number | null;
  estimatedWaitMinutes?: number | null;
}

interface DriverQueueStatus {
  detectedAirport?: {
    code: string;
    name: string;
  } | null;
  detectedAirportLot?: {
    lotCode?: string;
    lotName?: string;
    inRequiredLot?: boolean;
  } | null;
  pickupZone?: {
    code?: string;
    name?: string;
  } | null;
  queueEntry?: QueueEntrySnapshot | null;
}

interface AirportPickupInstructions {
  isAirportPickup?: boolean;
  airport?: {
    code: string;
    name: string;
  } | null;
  terminal?: string | null;
  requiredLot?: {
    code?: string;
    name?: string;
    inRequiredLot?: boolean;
  } | null;
  pickupZone?: {
    code?: string;
    name?: string;
  } | null;
  pickupLane?: {
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
  rideCategory?: RideCategory;
  enableAirportFlow?: boolean;
}

export default function RydinexMap({
  tripId,
  userId,
  userType,
  backendUrl = BACKEND_URL,
  onLocationUpdate,
  initialMapType = 'standard',
  rideCategory = 'black_car',
  enableAirportFlow = true,
}: RydinexMapProps) {
  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<any>(null);
  const locationWatchRef = useRef<number | null>(null);
  const airportRefreshRef = useRef(0);

  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [riderLocation, setRiderLocation] = useState<LocationData | null>(null);
  const [polylinePoints, setPolylinePoints] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>(initialMapType);
  const [stats, setStats] = useState({
    distance: 0,
    duration: 0,
    avgSpeed: 0,
    maxSpeed: 0,
  });
  const [airportInstructions, setAirportInstructions] = useState<AirportPickupInstructions | null>(null);
  const [queueStatus, setQueueStatus] = useState<DriverQueueStatus | null>(null);
  const [airportFlowError, setAirportFlowError] = useState('');
  const [queueActionLoading, setQueueActionLoading] = useState(false);

  const refreshAirportFlow = useCallback(
    async (location: LocationData) => {
      if (!enableAirportFlow || userType !== 'driver') {
        return;
      }

      const query = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        rideCategory,
      });

      try {
        const [pickupResponse, statusResponse] = await Promise.all([
          fetch(`${backendUrl}/api/airport-queue/pickup-instructions?${query.toString()}`),
          fetch(`${backendUrl}/api/airport-queue/driver/${encodeURIComponent(userId)}/status?${query.toString()}`),
        ]);

        if (pickupResponse.status === 403) {
          const deniedPayload = await pickupResponse.json();
          setAirportFlowError(deniedPayload?.message || 'Pickup is not allowed from this location.');
          setAirportInstructions(null);
        } else if (pickupResponse.ok) {
          const pickupPayload = await pickupResponse.json();
          setAirportInstructions(pickupPayload);
          setAirportFlowError('');
        } else {
          const pickupFailure = await pickupResponse.json().catch(() => ({}));
          setAirportFlowError(pickupFailure?.message || 'Unable to fetch airport pickup instructions.');
        }

        if (statusResponse.ok) {
          const statusPayload = await statusResponse.json();
          setQueueStatus(statusPayload);
        }
      } catch (requestError: unknown) {
        const message = requestError instanceof Error ? requestError.message : 'Failed to sync airport queue state.';
        setAirportFlowError(message);
      }
    },
    [backendUrl, enableAirportFlow, rideCategory, userId, userType]
  );

  const handleJoinQueue = useCallback(async () => {
    if (!currentLocation) {
      Alert.alert('Location Required', 'Current location is required to enter queue.');
      return;
    }

    const airportCode =
      airportInstructions?.airport?.code ||
      queueStatus?.detectedAirport?.code ||
      null;

    if (!airportCode) {
      Alert.alert('Airport Not Detected', 'Move inside ORD or MDW airport area before joining queue.');
      return;
    }

    try {
      setQueueActionLoading(true);

      const response = await fetch(`${backendUrl}/api/airport-queue/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: userId,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          airportCode,
          queueType: 'airport',
          rideCategory,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to enter airport queue.');
      }

      await refreshAirportFlow(currentLocation);
      Alert.alert('Queue Updated', 'You are now in the airport queue.');
    } catch (requestError: unknown) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to enter airport queue.';
      Alert.alert('Queue Error', message);
    } finally {
      setQueueActionLoading(false);
    }
  }, [airportInstructions, backendUrl, currentLocation, queueStatus, refreshAirportFlow, rideCategory, userId]);

  const handleExitQueue = useCallback(async () => {
    try {
      setQueueActionLoading(true);

      const response = await fetch(`${backendUrl}/api/airport-queue/exit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverId: userId,
          queueType: queueStatus?.queueEntry?.queueType || 'airport',
          airportCode: queueStatus?.queueEntry?.airportCode || airportInstructions?.airport?.code || null,
          eventCode: queueStatus?.queueEntry?.eventCode || null,
          reason: 'Driver left queue from app action.',
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to exit airport queue.');
      }

      if (currentLocation) {
        await refreshAirportFlow(currentLocation);
      }
    } catch (requestError: unknown) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to exit airport queue.';
      Alert.alert('Queue Error', message);
    } finally {
      setQueueActionLoading(false);
    }
  }, [airportInstructions, backendUrl, currentLocation, queueStatus, refreshAirportFlow, userId]);

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

          // Request trip stats
          socketRef.current.emit('get-trip-stats', { tripId });
        });

        socketRef.current.on('location-updated', (data: any) => {
          // Receive rider's location or other updates
          if (data.driverId === userId) {
            // Add to own polyline
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
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize Socket.io:', error);
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
          refreshAirportFlow(location);

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

          const now = Date.now();
          if (enableAirportFlow && userType === 'driver' && now - airportRefreshRef.current > 12000) {
            airportRefreshRef.current = now;
            refreshAirportFlow(location);
          }

          // Emit to backend (driver sends location)
          socketRef.current?.emit('location-update', {
            tripId,
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            altitude,
          });
        },
        error => {
          console.error('Error watching position:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 1000,
          distanceFilter: 5, // Update every 5 meters for driver precision
        }
      );
    };

    startLocationTracking();

    return () => {
      if (locationWatchRef.current !== null) {
        Geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, [enableAirportFlow, onLocationUpdate, refreshAirportFlow, tripId, userId, userType]);

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
          {/* Current driver location */}
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title="Your Location"
              pinColor="#3388ff"
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
        </MapView>
      )}

      {/* Map Type Switcher */}
      {enableAirportFlow && userType === 'driver' && (
        <View style={styles.airportCard}>
          <Text style={styles.airportTitle}>Airport Ops</Text>
          <Text style={styles.airportMeta}>Category: {rideCategory === 'black_suv' ? 'Black SUV' : 'Black Car'}</Text>

          {airportInstructions?.isAirportPickup && (
            <>
              <Text style={styles.airportMeta}>
                Airport: {airportInstructions.airport?.code || '-'} {airportInstructions.terminal ? `- ${airportInstructions.terminal}` : ''}
              </Text>
              <Text style={styles.airportMeta}>Lot: {airportInstructions.requiredLot?.name || '-'}</Text>
              <Text style={styles.airportMeta}>Zone: {airportInstructions.pickupZone?.name || '-'}</Text>
            </>
          )}

          {queueStatus?.queueEntry?.status === 'waiting' ? (
            <Text style={styles.queueStatusText}>
              In Queue: Position {queueStatus?.queueEntry?.position || '-'} {queueStatus?.queueEntry?.estimatedWaitMinutes !== null && queueStatus?.queueEntry?.estimatedWaitMinutes !== undefined ? `• ETA ${queueStatus.queueEntry.estimatedWaitMinutes}m` : ''}
            </Text>
          ) : (
            <Text style={styles.queueStatusText}>Not currently in queue</Text>
          )}

          {airportFlowError ? <Text style={styles.airportErrorText}>{airportFlowError}</Text> : null}

          <View style={styles.queueActionsRow}>
            <Text
              style={[styles.queueButton, queueActionLoading && styles.queueButtonDisabled]}
              onPress={queueActionLoading ? undefined : handleJoinQueue}
            >
              Join Queue
            </Text>
            <Text
              style={[styles.queueButtonSecondary, queueActionLoading && styles.queueButtonDisabled]}
              onPress={queueActionLoading ? undefined : handleExitQueue}
            >
              Exit Queue
            </Text>
          </View>
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

      {/* Current speed display */}
      <View style={styles.speedContainer}>
        <Text style={styles.speedValue}>{(currentLocation?.speed || 0).toFixed(0)}</Text>
        <Text style={styles.speedUnit}>km/h</Text>
      </View>

      {/* Trip stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Trip Stats</Text>
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
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Max Speed:</Text>
          <Text style={styles.statValue}>{stats.maxSpeed.toFixed(1)} km/h</Text>
        </View>
      </View>
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
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  airportCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 92,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 3,
  },
  airportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  airportMeta: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },
  queueStatusText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  airportErrorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#b91c1c',
  },
  queueActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  queueButton: {
    backgroundColor: '#0f766e',
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  queueButtonSecondary: {
    backgroundColor: '#334155',
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  queueButtonDisabled: {
    opacity: 0.6,
  },
  mapTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#3388ff',
    fontWeight: '500',
    textAlign: 'center',
  },
  mapTypeButtonActive: {
    backgroundColor: '#3388ff',
    color: 'white',
    fontWeight: 'bold',
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
});
