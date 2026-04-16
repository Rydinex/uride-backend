import 'react-native-gesture-handler';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';

type RootStackParamList = {
  Registration: undefined;
  AddPaymentMethod: undefined;
  Home: undefined;
  RequestRide: undefined;
  WaitingForDriver: { tripId?: string } | undefined;
  TripProgress: { tripId: string };
  Receipt: { tripId: string };
  Support: { tripId?: string } | undefined;
};

type RiderHomeData = {
  greeting: string;
  status: string;
  totalPaymentMethods: number;
  defaultPaymentMethod: {
    brand?: string;
    last4?: string;
  } | null;
  quickActions: string[];
};

type NearbyDriver = {
  driverId: string;
  latitude: number;
  longitude: number;
  distanceKm?: number | null;
  updatedAt?: number;
};

type TripPoint = {
  latitude: number;
  longitude: number;
  address?: string;
};

type RideCategory = 'rydinex_regular' | 'rydinex_comfort' | 'rydinex_xl' | 'rydinex_green';

type RiderTrip = {
  _id: string;
  status: string;
  rideCategory?: RideCategory;
  serviceDogRequested?: boolean;
  serviceDogFee?: number | null;
  teenPickup?: boolean;
  teenSeatingPolicy?: 'none' | 'back_seat_only' | string;
  specialInstructions?: string;
  pickup: TripPoint;
  dropoff: TripPoint;
  fareEstimate?: number | null;
  upfrontFare?: number | null;
  surgeMultiplier?: number | null;
  currency?: string;
  actualDistanceMiles?: number | null;
  actualDurationMinutes?: number | null;
  currentDriverLocation?: {
    latitude: number;
    longitude: number;
    speedKph?: number | null;
    recordedAt?: string;
  } | null;
  driver?: {
    _id?: string;
    name?: string;
    phone?: string;
    email?: string;
    status?: string;
    vehicle?: {
      _id?: string;
      make?: string;
      model?: string;
      year?: number;
      plateNumber?: string;
      color?: string;
      photoUrl?: string;
    } | null;
  } | null;
};

type UpfrontPricingQuote = {
  rideCategory?: RideCategory;
  serviceDogRequested?: boolean;
  serviceDogFee?: number;
  teenPickup?: boolean;
  teenSeatingPolicy?: 'none' | 'back_seat_only' | string;
  specialInstructions?: string;
  upfrontFare: number;
  surgeMultiplier: number;
  distanceMiles: number;
  durationMinutes: number;
  demandRatio: number;
  demandCount?: number;
  supplyCount?: number;
  baseFare?: number;
  perMileRate?: number;
  perMinuteRate?: number;
  distanceCharge?: number;
  timeCharge?: number;
  subtotal?: number;
  airportFee?: number;
  surgeRadiusKm?: number;
  platformSharePercent?: number;
  driverSharePercent?: number;
  surgeProfile?: {
    sensitivity?: number;
    maxMultiplier?: number;
  };
  surgeTransparency?: {
    formula?: string;
    sensitivity?: number;
    maxMultiplier?: number;
    rawMultiplier?: number;
    appliedMultiplier?: number;
  };
  currency?: string;
};

type FavoriteLocation = {
  _id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  placeType: 'home' | 'work' | 'other';
};

type AirportPickupInstructions = {
  operationType?: 'airport' | 'event' | 'city';
  isAirportPickup: boolean;
  isEventPickup?: boolean;
  terminal?: number | null;
  airport: {
    code: 'ORD' | 'MDW';
    name: string;
  } | null;
  event?: {
    code: 'UNITED_CENTER' | 'WRIGLEY_FIELD' | 'SOLDIER_FIELD';
    name: string;
    queueOpen?: boolean;
  } | null;
  queueGroup?: 'regular' | 'black_car';
  requiredLot?: {
    code?: string;
    name?: string;
    inRequiredLot?: boolean;
  } | null;
  pickupZone?: {
    code?: string;
    name?: string;
    laneType?: 'regular' | 'black_car';
  } | null;
  stagingArea?: {
    code?: string;
    name?: string;
    inRequiredStagingArea?: boolean;
  } | null;
  pickupLane?: {
    code?: string;
    name?: string;
    laneType?: 'regular' | 'black_car';
    message?: string;
  } | null;
  instructions: string[];
  message?: string;
};

type TripTrackingResponse = {
  tripId: string;
  status: string;
  pickup: TripPoint;
  dropoff: TripPoint;
  currentDriverLocation?: {
    latitude: number;
    longitude: number;
    speedKph?: number | null;
    recordedAt?: string;
  } | null;
  routePoints: Array<{
    latitude: number;
    longitude: number;
    recordedAt?: string;
  }>;
  actualDistanceMiles?: number;
  actualDurationMinutes?: number;
  rider?: {
    name?: string;
    phone?: string;
  };
  driver?: {
    name?: string;
    phone?: string;
  };
};

type TripReceipt = {
  receiptId: string;
  tripId: string;
  generatedAt: string;
  currency: string;
  fare: {
    surgeMultiplier: number;
    upfrontFare: number;
    finalFare: number;
    serviceDogFee?: number;
    tipAmount?: number;
    tipUpdatedAt?: string;
    totalCharged?: number;
    platformCommission: number;
    platformCommissionRate: number;
    driverEarnings: number;
    driverTotalEarnings?: number;
  };
  trip: {
    status: string;
    serviceDogFee?: number;
    startedAt?: string;
    endedAt?: string;
    tipAmount?: number;
    totalCharged?: number;
    pickup?: TripPoint;
    dropoff?: TripPoint;
    distanceMiles?: number;
    driverTotalEarnings?: number;
    durationMinutes?: number;
    routePointCount?: number;
  };
  tipPolicy?: {
    isTipEditable?: boolean;
    tipUpdateLocked?: boolean;
    tipEditableUntil?: string | null;
    tipUpdateWindowHours?: number;
    isUnlimitedTipWindow?: boolean;
    minutesRemaining?: number | null;
  };
  feedback?: {
    overallRating?: number | null;
    driverProfessionalismRating?: number | null;
    carCleanlinessRating?: number | null;
    amenitiesRating?: number | null;
    greetingRating?: number | null;
    comments?: string;
    submittedAt?: string | null;
    updatedAt?: string | null;
  };
  feedbackPending?: boolean;
  tipPresetOptions?: Array<{
    percent: number;
    amount: number;
  }>;
};

type PendingTripFeedback = {
  hasPendingFeedback: boolean;
  tripId: string;
  promptMessage?: string;
  fare?: {
    finalFare?: number;
    tipAmount?: number;
    tipPresetOptions?: Array<{
      percent: number;
      amount: number;
    }>;
  };
};

type OnboardingContext = {
  riderId: string;
  setRiderId: (value: string) => void;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
// Set this for physical-device testing (example: 192.168.1.40).
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

const BACKEND_URL = 'https://uride-backend-production.up.railway.app';
const API_BASE_URL = `${BACKEND_URL}/api`;
const SOCKET_URL = BACKEND_URL;

const DEFAULT_REGION: Region = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const PREMIUM_COLORS = {
  background: '#f4f6fb',
  card: '#ffffff',
  textPrimary: '#102a43',
  textSecondary: '#4c6272',
  divider: '#d9e2ec',
  accent: '#1f6feb',
  accentSoft: '#e7f1ff',
  successSoft: '#ecfdf3',
  warningSoft: '#fff8e8',
  danger: '#dc2626',
  shadow: '#6b7c93',
};

const TIP_PERCENT_OPTIONS = [10, 15, 20, 25];

const RIDE_CATEGORY_LABELS: Record<RideCategory, string> = {
  rydinex_regular: 'Rydinex Regular',
  rydinex_comfort: 'Rydinex Comfort',
  rydinex_xl: 'Rydinex XL',
  rydinex_green: 'Rydinex Green',
};

const RIDE_CATEGORY_OPTIONS: Array<{
  value: RideCategory;
  label: string;
}> = [
  {
    value: 'rydinex_regular',
    label: 'Rydinex Regular',
  },
  {
    value: 'rydinex_comfort',
    label: 'Rydinex Comfort',
  },
  {
    value: 'rydinex_xl',
    label: 'Rydinex XL',
  },
  {
    value: 'rydinex_green',
    label: 'Rydinex Green',
  },
];

function formatRideCategoryLabel(category: RideCategory | string | null | undefined) {
  const normalized = String(category || '')
    .trim()
    .toLowerCase();

  if ((normalized as RideCategory) in RIDE_CATEGORY_LABELS) {
    return RIDE_CATEGORY_LABELS[normalized as RideCategory];
  }

  return normalized ? normalized.replace(/_/g, ' ').toUpperCase() : 'Rydinex Regular';
}

function haversineDistanceKm(pointA: TripPoint, pointB: TripPoint) {
  const earthRadiusKm = 6371;
  const latitudeDeltaRadians = (pointB.latitude - pointA.latitude) * (Math.PI / 180);
  const longitudeDeltaRadians = (pointB.longitude - pointA.longitude) * (Math.PI / 180);

  const originLatitudeRadians = pointA.latitude * (Math.PI / 180);
  const destinationLatitudeRadians = pointB.latitude * (Math.PI / 180);

  const a =
    Math.sin(latitudeDeltaRadians / 2) * Math.sin(latitudeDeltaRadians / 2) +
    Math.sin(longitudeDeltaRadians / 2) * Math.sin(longitudeDeltaRadians / 2) *
      Math.cos(originLatitudeRadians) *
      Math.cos(destinationLatitudeRadians);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function estimateEtaMinutes(distanceKm: number, speedKph = 28) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return null;
  }

  const safeSpeed = Math.max(Number(speedKph) || 28, 8);
  return Math.max(1, Math.round((distanceKm / safeSpeed) * 60));
}

function formatEtaLabel(minutes: number | null) {
  if (!Number.isFinite(Number(minutes)) || Number(minutes) <= 0) {
    return 'ETA calculating';
  }

  if (Number(minutes) <= 1) {
    return 'Arriving now';
  }

  return `${minutes} min`;
}

function normalizeOptionalRating(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return null;
  }

  return parsed;
}

function buildTipPresetOptions(finalFare: number | null | undefined) {
  const normalizedFare = Math.max(Number(finalFare) || 0, 0);
  return TIP_PERCENT_OPTIONS.map(percent => ({
    percent,
    amount: Number((Math.round(((normalizedFare * percent) / 100 + Number.EPSILON) * 100) / 100).toFixed(2)),
  }));
}

type DriverVehicle = NonNullable<NonNullable<RiderTrip['driver']>['vehicle']>;

function buildVehicleLabel(vehicle: DriverVehicle | null | undefined) {
  if (!vehicle || typeof vehicle !== 'object') {
    return 'Vehicle details loading';
  }

  const year = vehicle.year ? String(vehicle.year) : '';
  const make = vehicle.make || '';
  const model = vehicle.model || '';

  return `${year} ${make} ${model}`.trim() || 'Vehicle details loading';
}

function buildVehiclePhotoUrl(vehicle: DriverVehicle | null | undefined) {
  if (!vehicle || typeof vehicle !== 'object') {
    return 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=640&q=70';
  }

  if (vehicle.photoUrl) {
    return vehicle.photoUrl;
  }

  const seed = encodeURIComponent(`${vehicle.make || 'ride'}-${vehicle.model || 'premium'}`);
  return `https://source.unsplash.com/640x400/?car,${seed}`;
}

function App() {
  const [riderId, setRiderId] = useState('');
  const contextValue = useMemo(
    () => ({
      riderId,
      setRiderId,
    }),
    [riderId]
  );

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Registration"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: PREMIUM_COLORS.textPrimary,
            headerTitleStyle: {
              fontWeight: '700',
            },
            contentStyle: {
              backgroundColor: PREMIUM_COLORS.background,
            },
          }}
        >
          <Stack.Screen name="Registration" options={{ title: 'Rider Access' }}>
            {props => <RegistrationScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="AddPaymentMethod" options={{ title: 'Add Payment Method' }}>
            {props => <AddPaymentMethodScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="Home" options={{ title: 'Rider Home' }}>
            {props => <HomeScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="RequestRide" options={{ title: 'Request Ride' }}>
            {props => <RequestRideScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="WaitingForDriver" options={{ title: 'Waiting for Driver' }}>
            {props => <WaitingForDriverScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="TripProgress" options={{ title: 'Trip Progress' }}>
            {props => <TripProgressScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="Receipt" options={{ title: 'Trip Receipt' }}>
            {props => <ReceiptScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="Support" options={{ title: 'Support' }}>
            {props => <SupportScreen {...props} context={contextValue} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

type RegistrationProps = NativeStackScreenProps<RootStackParamList, 'Registration'> & {
  context: OnboardingContext;
};

function RegistrationScreen({ navigation, context }: RegistrationProps) {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submitRiderAccess = useCallback(async () => {
    const requiresRegistrationFields = !isLoginMode;
    if (!email || !password || (requiresRegistrationFields && (!name || !phone))) {
      Alert.alert('Validation', isLoginMode ? 'Please enter email and password.' : 'Please fill in all required fields.');
      return;
    }

    try {
      setLoading(true);
      const endpoint = isLoginMode ? '/riders/login' : '/riders/register';
      const requestBody = isLoginMode
        ? { email, password }
        : { name, phone, email, password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || (isLoginMode ? 'Rider login failed.' : 'Rider registration failed.'));
      }

      const resolvedRiderId = payload?.rider?.id;
      if (!resolvedRiderId) {
        throw new Error('Rider account response is missing the rider id.');
      }

      context.setRiderId(resolvedRiderId);
      navigation.navigate(isLoginMode ? 'Home' : 'AddPaymentMethod');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Unable to ${isLoginMode ? 'sign in rider' : 'register rider'}.`;
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [context, email, isLoginMode, name, navigation, password, phone]);

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      <Text style={styles.helperText}>
        {isLoginMode
          ? 'Sign in with your existing rider account.'
          : 'Create a rider account and continue onboarding.'}
      </Text>
      {!isLoginMode ? <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} /> : null}
      {!isLoginMode ? (
        <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      ) : null}
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {loading ? <ActivityIndicator /> : <Button title={isLoginMode ? 'Sign In' : 'Create Rider Account'} onPress={submitRiderAccess} />}
      <Button
        title={isLoginMode ? 'Need a new account? Register' : 'Already have an account? Sign In'}
        onPress={() => setIsLoginMode(previous => !previous)}
      />
    </ScrollView>
  );
}

type AddPaymentProps = NativeStackScreenProps<RootStackParamList, 'AddPaymentMethod'> & {
  context: OnboardingContext;
};

function AddPaymentMethodScreen({ navigation, context }: AddPaymentProps) {
  const [cardNumber, setCardNumber] = useState('4242424242424242');
  const [expMonth, setExpMonth] = useState('12');
  const [expYear, setExpYear] = useState('2030');
  const [cvc, setCvc] = useState('123');
  const [loading, setLoading] = useState(false);

  const submitPaymentMethod = useCallback(async () => {
    if (!context.riderId) {
      Alert.alert('Missing Rider', 'Please complete rider registration first.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/riders/${context.riderId}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber,
          expMonth: Number(expMonth),
          expYear: Number(expYear),
          cvc,
          isDefault: true,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to add payment method.');
      }

      navigation.navigate('Home');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to add payment method.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [cardNumber, context.riderId, cvc, expMonth, expYear, navigation]);

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      <Text style={styles.helperText}>Use Stripe test card values for MVP testing.</Text>
      <TextInput style={styles.input} placeholder="Card number" value={cardNumber} onChangeText={setCardNumber} keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="Expiry month (MM)" value={expMonth} onChangeText={setExpMonth} keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="Expiry year (YYYY)" value={expYear} onChangeText={setExpYear} keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="CVC" value={cvc} onChangeText={setCvc} keyboardType="number-pad" secureTextEntry />
      {loading ? <ActivityIndicator /> : <Button title="Add Payment Method" onPress={submitPaymentMethod} />}
    </ScrollView>
  );
}

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'> & {
  context: OnboardingContext;
};

function HomeScreen({ navigation, context }: HomeProps) {
  const [homeData, setHomeData] = useState<RiderHomeData | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastNearbyRefreshAt, setLastNearbyRefreshAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const mapRegionRef = useRef<Region>(DEFAULT_REGION);
  const lastNearbySubscriptionAtRef = useRef<number>(0);
  const lastPendingFeedbackPromptTripIdRef = useRef<string>('');

  const loadPendingFeedbackPrompt = useCallback(
    async (showAlert: boolean) => {
      if (!context.riderId) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/trips/rider/${context.riderId}/feedback-pending`);
        const payload: PendingTripFeedback = await response.json();

        if (!response.ok) {
          return;
        }

        if (!payload?.tripId) {
          return;
        }

        if (!showAlert) {
          return;
        }

        if (lastPendingFeedbackPromptTripIdRef.current === payload.tripId) {
          return;
        }

        lastPendingFeedbackPromptTripIdRef.current = payload.tripId;

        Alert.alert(
          'Rate Your Last Trip',
          payload.promptMessage || 'Rate your driver and add a tip in less than a minute.',
          [
            {
              text: 'Later',
              style: 'cancel',
            },
            {
              text: 'Rate Now',
              onPress: () => navigation.navigate('Receipt', { tripId: payload.tripId }),
            },
          ]
        );
      } catch {
        // Ignore pending feedback fetch errors to keep Home responsive.
      }
    },
    [context.riderId, navigation]
  );

  const loadHome = useCallback(async () => {
    if (!context.riderId) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_BASE_URL}/riders/${context.riderId}/home`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load home data.');
      }

      setHomeData(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load home data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [context.riderId]);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permissionResult = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location Permission',
      message: 'Rydinex needs your location to show nearby drivers on the map.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    return permissionResult === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const loadCurrentLocation = useCallback(async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return;
    }

    Geolocation.getCurrentPosition(
      position => {
        const nextRegion = {
          ...mapRegionRef.current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        mapRegionRef.current = nextRegion;
        setMapRegion(previousRegion => ({
          ...previousRegion,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
      },
      locationError => {
        setError(locationError.message || 'Unable to get your location for map center.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );
  }, [requestLocationPermission]);

  const subscribeNearbyDrivers = useCallback((force = false) => {
    if (!context.riderId) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastNearbySubscriptionAtRef.current < 3500) {
      return;
    }

    lastNearbySubscriptionAtRef.current = now;

    if (!socketRef.current) {
      const socket = io(SOCKET_URL, {
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        setSocketConnected(true);
        setError('');
      });

      socket.on('disconnect', () => {
        setSocketConnected(false);
      });

      socket.on('nearby:drivers', payload => {
        const parsedDrivers = Array.isArray(payload?.drivers)
          ? payload.drivers.map((entry: NearbyDriver) => ({
              driverId: String(entry.driverId),
              latitude: Number(entry.latitude),
              longitude: Number(entry.longitude),
              distanceKm: entry.distanceKm ?? null,
              updatedAt: entry.updatedAt,
            }))
                .filter((entry: NearbyDriver) => Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude))
          : [];

        setNearbyDrivers(parsedDrivers);
        setLastNearbyRefreshAt(payload?.generatedAt || Date.now());
      });

      socket.on('nearby:error', payload => {
        setError(payload?.message || 'Unable to load nearby drivers.');
      });

      socket.on('connect_error', connectionError => {
        setError(connectionError.message || 'Realtime map connection failed.');
      });

      socketRef.current = socket;
    }

    socketRef.current.emit(
      'rider:subscribeNearby',
      {
        riderId: context.riderId,
        latitude: mapRegionRef.current.latitude,
        longitude: mapRegionRef.current.longitude,
        radiusKm: 5,
        limit: 30,
      },
      (acknowledgement: { ok?: boolean; message?: string } | undefined) => {
        if (acknowledgement && acknowledgement.ok === false) {
          setError(acknowledgement.message || 'Unable to subscribe nearby drivers.');
        }
      }
    );
  }, [context.riderId]);

  useEffect(() => {
    loadHome();
    loadCurrentLocation();
    loadPendingFeedbackPrompt(false);
  }, [loadCurrentLocation, loadHome, loadPendingFeedbackPrompt]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadPendingFeedbackPrompt(true);
    });

    return unsubscribe;
  }, [loadPendingFeedbackPrompt, navigation]);

  useEffect(() => {
    subscribeNearbyDrivers(true);
  }, [subscribeNearbyDrivers]);

  useEffect(
    () => () => {
      if (socketRef.current) {
        socketRef.current.emit('rider:unsubscribeNearby');
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
        socketRef.current = null;
      }
    },
    []
  );

  const onMapRegionChangeComplete = useCallback((region: Region) => {
    mapRegionRef.current = region;
    setMapRegion(region);
    subscribeNearbyDrivers();
  }, [subscribeNearbyDrivers]);

  const formatTime = useCallback((timestamp: number | null) => {
    if (!timestamp) {
      return 'Not updated yet';
    }

    return new Date(timestamp).toLocaleTimeString();
  }, []);

  const onQuickActionPress = useCallback((action: string) => {
    const normalized = action.toLowerCase();

    if (normalized.includes('book')) {
      navigation.navigate('RequestRide');
      return;
    }

    if (normalized.includes('support')) {
      navigation.navigate('Support');
      return;
    }

    if (normalized.includes('favorite')) {
      navigation.navigate('RequestRide');
      return;
    }

    Alert.alert('Coming soon', `${action} will be available in the next rider release.`);
  }, [navigation]);

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Premium Rider Experience</Text>
        <Text style={styles.heroTitle}>{homeData?.greeting || 'Welcome to Rydinex'}</Text>
        <Text style={styles.heroSubText}>Account status: {homeData?.status || 'active'} | Transparent fares | Live driver intelligence</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wallet Snapshot</Text>
        <Text style={styles.cardSubText}>Payment methods: {homeData?.totalPaymentMethods ?? 0}</Text>
        <Text style={styles.cardSubTextStrong}>
          Default: {homeData?.defaultPaymentMethod ? `${homeData.defaultPaymentMethod.brand} ****${homeData.defaultPaymentMethod.last4}` : 'Not set'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          {(homeData?.quickActions || ['Book Ride', 'Favorites', 'Support']).map(action => (
            <Pressable
              key={action}
              style={({ pressed }) => [styles.actionChip, pressed ? styles.actionChipPressed : null]}
              onPress={() => onQuickActionPress(action)}
            >
              <Text style={styles.actionChipText}>{action}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Network</Text>
        <View style={styles.metricRow}>
          <View style={[styles.metricPill, socketConnected ? styles.metricPillOnline : styles.metricPillOffline]}>
            <Text style={styles.metricPillText}>{socketConnected ? 'Live connected' : 'Reconnecting'}</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricPillText}>{nearbyDrivers.length} drivers nearby</Text>
          </View>
        </View>
        <Text style={styles.cardSubText}>Last refresh: {formatTime(lastNearbyRefreshAt)}</Text>

        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={onMapRegionChangeComplete}
            showsUserLocation
          >
            {nearbyDrivers.map(driver => (
              <Marker
                key={driver.driverId}
                coordinate={{
                  latitude: driver.latitude,
                  longitude: driver.longitude,
                }}
                title={`Driver ${driver.driverId.slice(-6)}`}
                description={
                  driver.distanceKm !== null && driver.distanceKm !== undefined
                    ? `${driver.distanceKm.toFixed(2)} km away`
                    : 'Nearby driver'
                }
              />
            ))}
          </MapView>
        </View>
      </View>

      <View style={styles.buttonStack}>
        <Button title="Request Ride" onPress={() => navigation.navigate('RequestRide')} />
        <Button title="Refresh Nearby Drivers" onPress={() => subscribeNearbyDrivers(true)} />
        <Button title="Rate Last Trip" onPress={() => loadPendingFeedbackPrompt(true)} />
        <Button title="Support" onPress={() => navigation.navigate('Support')} />
        <Button title="Refresh Home" onPress={loadHome} />
      </View>
    </ScrollView>
  );
}

type RequestRideProps = NativeStackScreenProps<RootStackParamList, 'RequestRide'> & {
  context: OnboardingContext;
};

function RequestRideScreen({ navigation, context }: RequestRideProps) {
  const [rideCategory, setRideCategory] = useState<RideCategory>('rydinex_regular');
  const [serviceDogRequested, setServiceDogRequested] = useState(false);
  const [teenPickup, setTeenPickup] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('Current location pickup');
  const [pickupLatitude, setPickupLatitude] = useState('6.5244');
  const [pickupLongitude, setPickupLongitude] = useState('3.3792');
  const [dropoffAddress, setDropoffAddress] = useState('Destination');
  const [dropoffLatitude, setDropoffLatitude] = useState('6.5700');
  const [dropoffLongitude, setDropoffLongitude] = useState('3.3500');
  const [upfrontPricing, setUpfrontPricing] = useState<UpfrontPricingQuote | null>(null);
  const [airportPickupInfo, setAirportPickupInfo] = useState<AirportPickupInstructions | null>(null);
  const [airportRestrictionMessage, setAirportRestrictionMessage] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [locationAutofillLoading, setLocationAutofillLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);

  const hasOrdTerminal5Restriction = useMemo(() => {
    const inOrdTerminal5 = airportPickupInfo?.airport?.code === 'ORD' && Number(airportPickupInfo?.terminal) === 5;

    if (inOrdTerminal5) {
      return true;
    }

    const normalizedMessage = airportRestrictionMessage.toLowerCase();
    return normalizedMessage.includes('terminal 5') && normalizedMessage.includes('cannot pick up');
  }, [airportPickupInfo?.airport?.code, airportPickupInfo?.terminal, airportRestrictionMessage]);

  const loadFavoriteLocations = useCallback(async () => {
    if (!context.riderId) {
      return;
    }

    try {
      setFavoritesLoading(true);
      const response = await fetch(`${API_BASE_URL}/riders/${context.riderId}/favorite-locations`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to fetch favorite locations.');
      }

      const normalizedFavorites = Array.isArray(payload?.favorites)
        ? payload.favorites.map((favorite: FavoriteLocation) => ({
            _id: String(favorite._id),
            label: String(favorite.label || 'Favorite'),
            address: String(favorite.address || ''),
            latitude: Number(favorite.latitude),
            longitude: Number(favorite.longitude),
            placeType: (favorite.placeType || 'other') as FavoriteLocation['placeType'],
          }))
            .filter((favorite: FavoriteLocation) => Number.isFinite(favorite.latitude) && Number.isFinite(favorite.longitude))
        : [];

      setFavoriteLocations(normalizedFavorites);
    } catch {
      setFavoriteLocations([]);
    } finally {
      setFavoritesLoading(false);
    }
  }, [context.riderId]);

  const applyFavoriteLocation = useCallback((favorite: FavoriteLocation, target: 'pickup' | 'dropoff') => {
    if (target === 'pickup') {
      setPickupAddress(favorite.address || favorite.label);
      setPickupLatitude(favorite.latitude.toFixed(6));
      setPickupLongitude(favorite.longitude.toFixed(6));
      return;
    }

    setDropoffAddress(favorite.address || favorite.label);
    setDropoffLatitude(favorite.latitude.toFixed(6));
    setDropoffLongitude(favorite.longitude.toFixed(6));
  }, []);

  const saveFavoriteLocation = useCallback(async (target: 'pickup' | 'dropoff', placeType: FavoriteLocation['placeType']) => {
    if (!context.riderId) {
      Alert.alert('Missing Rider', 'Please complete rider onboarding first.');
      return;
    }

    const latitude = Number(target === 'pickup' ? pickupLatitude : dropoffLatitude);
    const longitude = Number(target === 'pickup' ? pickupLongitude : dropoffLongitude);
    const address = target === 'pickup' ? pickupAddress : dropoffAddress;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Invalid Coordinates', 'Set valid coordinates before saving a favorite.');
      return;
    }

    try {
      setFavoriteSaving(true);
      const response = await fetch(`${API_BASE_URL}/riders/${context.riderId}/favorite-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `${placeType === 'other' ? 'Saved' : placeType} ${target}`,
          address: address.trim() || `${target} favorite`,
          latitude,
          longitude,
          placeType,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to save favorite location.');
      }

      await loadFavoriteLocations();
      Alert.alert('Saved', 'Favorite location added.');
    } catch (saveError: unknown) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save favorite location.';
      Alert.alert('Favorites', message);
    } finally {
      setFavoriteSaving(false);
    }
  }, [context.riderId, dropoffAddress, dropoffLatitude, dropoffLongitude, loadFavoriteLocations, pickupAddress, pickupLatitude, pickupLongitude]);

  const removeFavoriteLocation = useCallback(async (favoriteId: string) => {
    if (!context.riderId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/riders/${context.riderId}/favorite-locations/${favoriteId}`, {
        method: 'DELETE',
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to remove favorite location.');
      }

      setFavoriteLocations(previous => previous.filter(location => location._id !== favoriteId));
    } catch (removeError: unknown) {
      const message = removeError instanceof Error ? removeError.message : 'Unable to remove favorite location.';
      Alert.alert('Favorites', message);
    }
  }, [context.riderId]);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permissionResult = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location Permission',
      message: 'Rydinex needs location access to auto-fill your pickup coordinates.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    return permissionResult === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const useCurrentPickupLocation = useCallback(async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Location permission is required to use current pickup location.');
      return;
    }

    try {
      setLocationAutofillLoading(true);

      const coordinates = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          error => {
            reject(new Error(error.message || 'Unable to get current location.'));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 1000,
          }
        );
      });

      setPickupLatitude(coordinates.latitude.toFixed(6));
      setPickupLongitude(coordinates.longitude.toFixed(6));
      setPickupAddress(previous => (previous && previous !== 'Current location pickup' ? previous : 'Current location'));
    } catch (locationError: unknown) {
      const message = locationError instanceof Error ? locationError.message : 'Unable to auto-fill pickup location.';
      Alert.alert('Location Error', message);
    } finally {
      setLocationAutofillLoading(false);
    }
  }, [requestLocationPermission]);

  const parseTripPoints = useCallback(() => {
    const parsedPickupLatitude = Number(pickupLatitude);
    const parsedPickupLongitude = Number(pickupLongitude);
    const parsedDropoffLatitude = Number(dropoffLatitude);
    const parsedDropoffLongitude = Number(dropoffLongitude);

    if (
      !Number.isFinite(parsedPickupLatitude) ||
      !Number.isFinite(parsedPickupLongitude) ||
      !Number.isFinite(parsedDropoffLatitude) ||
      !Number.isFinite(parsedDropoffLongitude)
    ) {
      return null;
    }

    return {
      pickup: {
        latitude: parsedPickupLatitude,
        longitude: parsedPickupLongitude,
        address: pickupAddress.trim() || 'Pickup',
      },
      dropoff: {
        latitude: parsedDropoffLatitude,
        longitude: parsedDropoffLongitude,
        address: dropoffAddress.trim() || 'Dropoff',
      },
    };
  }, [dropoffAddress, dropoffLatitude, dropoffLongitude, pickupAddress, pickupLatitude, pickupLongitude]);

  const loadUpfrontPricing = useCallback(async () => {
    const tripPoints = parseTripPoints();
    if (!tripPoints) {
      Alert.alert('Invalid Coordinates', 'Please enter valid pickup and dropoff coordinates.');
      return;
    }

    try {
      setPricingLoading(true);
      const response = await fetch(`${API_BASE_URL}/trips/upfront-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tripPoints,
          rideCategory,
          serviceDogRequested,
          teenPickup,
          teenSeatingPolicy: teenPickup ? 'back_seat_only' : 'none',
          specialInstructions: teenPickup ? 'Teen rider must sit in the back seat.' : '',
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to fetch upfront pricing.');
      }

      setUpfrontPricing(payload);
    } catch (pricingError: unknown) {
      const message = pricingError instanceof Error ? pricingError.message : 'Unable to load upfront pricing.';
      Alert.alert('Pricing Error', message);
    } finally {
      setPricingLoading(false);
    }
  }, [parseTripPoints, rideCategory, serviceDogRequested, teenPickup]);

  const loadAirportPickupInstructions = useCallback(async () => {
    const parsedPickupLatitude = Number(pickupLatitude);
    const parsedPickupLongitude = Number(pickupLongitude);

    if (!Number.isFinite(parsedPickupLatitude) || !Number.isFinite(parsedPickupLongitude)) {
      setAirportPickupInfo(null);
      setAirportRestrictionMessage('');
      return;
    }

    try {
      setInstructionsLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/airport-queue/pickup-instructions?latitude=${encodeURIComponent(
          String(parsedPickupLatitude)
        )}&longitude=${encodeURIComponent(String(parsedPickupLongitude))}&rideCategory=${encodeURIComponent(rideCategory)}`
      );

      const payload = await response.json();
      if (!response.ok) {
        setAirportPickupInfo(
          payload && typeof payload === 'object'
            ? {
                operationType: 'airport',
                isAirportPickup: true,
                isEventPickup: false,
                airport:
                  payload?.terminal || String(payload?.message || '').toLowerCase().includes('ord')
                    ? {
                        code: 'ORD',
                        name: 'O Hare International',
                      }
                    : null,
                terminal: Number.isFinite(Number(payload?.terminal)) ? Number(payload?.terminal) : null,
                event: null,
                queueGroup: 'regular',
                requiredLot: null,
                pickupZone: null,
                stagingArea: null,
                pickupLane: null,
                instructions: [],
                message: String(payload?.message || ''),
              }
            : null
        );
        setAirportRestrictionMessage(String(payload?.message || 'Pickup is restricted for this airport location.'));
        return;
      }

      setAirportPickupInfo(payload);
      setAirportRestrictionMessage('');
    } catch {
      setAirportPickupInfo(null);
      setAirportRestrictionMessage('');
    } finally {
      setInstructionsLoading(false);
    }
  }, [pickupLatitude, pickupLongitude, rideCategory]);

  const requestTrip = useCallback(async () => {
    if (!context.riderId) {
      Alert.alert('Missing Rider', 'Please complete rider onboarding first.');
      return;
    }

    if (hasOrdTerminal5Restriction) {
      Alert.alert(
        'ORD Terminal 5 Restriction',
        'Standard rides cannot be picked up at ORD Terminal 5. Please move pickup to Terminal 2 or 3.'
      );
      return;
    }

    const tripPoints = parseTripPoints();
    if (!tripPoints) {
      Alert.alert('Invalid Coordinates', 'Please enter valid pickup and dropoff coordinates.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/trips/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: context.riderId,
          rideCategory,
          serviceDogRequested,
          teenPickup,
          teenSeatingPolicy: teenPickup ? 'back_seat_only' : 'none',
          specialInstructions: teenPickup ? 'Teen rider must sit in the back seat.' : '',
          ...tripPoints,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to request trip.');
      }

      if (payload?.pricing) {
        setUpfrontPricing(payload.pricing);
      }

      navigation.navigate('WaitingForDriver', {
        tripId: payload?.trip?._id,
      });
    } catch (tripError: unknown) {
      const message = tripError instanceof Error ? tripError.message : 'Unable to request ride.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [
    context.riderId,
    navigation,
    parseTripPoints,
    hasOrdTerminal5Restriction,
    rideCategory,
    serviceDogRequested,
    teenPickup,
  ]);

  const formatMoney = useCallback((value: number | null | undefined) => {
    if (!Number.isFinite(Number(value))) {
      return 'N/A';
    }

    return `$${Number(value).toFixed(2)}`;
  }, []);

  useEffect(() => {
    loadAirportPickupInstructions();
  }, [loadAirportPickupInstructions]);

  useEffect(() => {
    loadFavoriteLocations();
  }, [loadFavoriteLocations]);

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Standard Booking</Text>
        <Text style={styles.heroTitle}>Ride with upfront confidence</Text>
        <Text style={styles.heroSubText}>Exact price preview, demand visibility, and no hidden surge surprises.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ride Category</Text>
        <Text style={styles.cardSubText}>Choose your car option with Rydinex upfront base pricing by category.</Text>
        <View style={styles.actionGrid}>
          {RIDE_CATEGORY_OPTIONS.map(option => (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.actionChip,
                rideCategory === option.value ? styles.actionChipSelected : null,
                pressed ? styles.actionChipPressed : null,
              ]}
              onPress={() => setRideCategory(option.value)}
            >
              <Text style={styles.actionChipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>Rydinex Green accepts hybrid or electric vehicles from model year 2013 or newer.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ride Options</Text>
        <Text style={styles.cardSubText}>Enable extra accommodations before fetching pricing.</Text>
        <View style={styles.actionGrid}>
          <Pressable
            style={({ pressed }) => [
              styles.actionChip,
              serviceDogRequested ? styles.actionChipSelected : null,
              pressed ? styles.actionChipPressed : null,
            ]}
            onPress={() => setServiceDogRequested(previous => !previous)}
          >
            <Text style={styles.actionChipText}>{serviceDogRequested ? 'Service Dog: ON' : 'Service Dog: OFF'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionChip,
              teenPickup ? styles.actionChipSelected : null,
              pressed ? styles.actionChipPressed : null,
            ]}
            onPress={() => setTeenPickup(previous => !previous)}
          >
            <Text style={styles.actionChipText}>{teenPickup ? 'Teen Pickup: ON' : 'Teen Pickup: OFF'}</Text>
          </Pressable>
        </View>
        {teenPickup ? <Text style={styles.helperText}>Teen policy: rider must sit in the back seat.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Favorite Locations</Text>
        {favoritesLoading ? <ActivityIndicator /> : null}
        {!favoritesLoading && favoriteLocations.length === 0 ? (
          <Text style={styles.cardSubText}>Save Home, Work, and custom spots for one-tap booking.</Text>
        ) : null}
        {favoriteLocations.map(location => (
          <View key={location._id} style={styles.favoriteItem}>
            <Text style={styles.cardSubTextStrong}>{location.label}</Text>
            <Text style={styles.cardSubText}>{location.address}</Text>
            <View style={styles.inlineButtonRow}>
              <Button title="Pickup" onPress={() => applyFavoriteLocation(location, 'pickup')} />
              <Button title="Dropoff" onPress={() => applyFavoriteLocation(location, 'dropoff')} />
              <Button title="Delete" onPress={() => removeFavoriteLocation(location._id)} />
            </View>
          </View>
        ))}
        {favoriteSaving ? <ActivityIndicator /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pickup</Text>
        <TextInput style={styles.input} value={pickupAddress} onChangeText={setPickupAddress} placeholder="Pickup address" />
        <TextInput style={styles.input} value={pickupLatitude} onChangeText={setPickupLatitude} placeholder="Pickup latitude" keyboardType="decimal-pad" />
        <TextInput style={styles.input} value={pickupLongitude} onChangeText={setPickupLongitude} placeholder="Pickup longitude" keyboardType="decimal-pad" />
        {locationAutofillLoading ? <ActivityIndicator /> : <Button title="Use Current Pickup Location" onPress={useCurrentPickupLocation} />}
        <View style={styles.inlineButtonRow}>
          <Button title="Save as Home" onPress={() => saveFavoriteLocation('pickup', 'home')} />
          <Button title="Save as Work" onPress={() => saveFavoriteLocation('pickup', 'work')} />
        </View>
        <View style={styles.inlineButtonRow}>
          <Button
            title={instructionsLoading ? 'Checking Airport Rules...' : 'Recheck Airport Rules'}
            onPress={loadAirportPickupInstructions}
            disabled={instructionsLoading}
          />
        </View>
        <Text style={styles.helperText}>Use this after editing pickup coordinates to refresh terminal and lane restrictions.</Text>
      </View>

      {instructionsLoading ? <ActivityIndicator /> : null}
      {hasOrdTerminal5Restriction ? (
        <View style={[styles.card, styles.criticalNoticeCard]}>
          <Text style={styles.cardTitle}>Critical Airport Restriction</Text>
          <Text style={styles.criticalNoticeText}>ORD Terminal 5 does not allow standard rideshare pickup.</Text>
          <Text style={styles.criticalNoticeText}>Move your pickup to ORD Terminal 2 or Terminal 3 to continue.</Text>
          {airportRestrictionMessage ? <Text style={styles.criticalNoticeText}>{airportRestrictionMessage}</Text> : null}
        </View>
      ) : null}

      {airportPickupInfo?.isAirportPickup || airportPickupInfo?.isEventPickup ? (
        <View style={[styles.card, styles.noticeCard]}>
          <Text style={styles.cardTitle}>
            {airportPickupInfo?.isAirportPickup ? 'Airport Operations' : 'Event Operations'}
          </Text>
          {airportPickupInfo?.isAirportPickup ? (
            <Text style={styles.cardSubText}>
              {airportPickupInfo.airport?.code} - {airportPickupInfo.airport?.name}
            </Text>
          ) : null}
          {airportPickupInfo?.terminal ? <Text style={styles.cardSubText}>Terminal: {airportPickupInfo.terminal}</Text> : null}
          {airportPickupInfo?.isEventPickup ? (
            <Text style={styles.cardSubText}>{airportPickupInfo.event?.name || 'Event venue'}</Text>
          ) : null}
          <Text style={styles.cardSubText}>Queue group: {(airportPickupInfo?.queueGroup || 'regular').toUpperCase()}</Text>
          {airportPickupInfo?.requiredLot?.name ? <Text style={styles.cardSubText}>Required lot: {airportPickupInfo.requiredLot.name}</Text> : null}
          {airportPickupInfo?.pickupZone?.name ? <Text style={styles.cardSubText}>Pickup zone: {airportPickupInfo.pickupZone.name}</Text> : null}
          {airportPickupInfo?.stagingArea?.name ? <Text style={styles.cardSubText}>Staging area: {airportPickupInfo.stagingArea.name}</Text> : null}
          {airportPickupInfo?.pickupLane?.name ? <Text style={styles.cardSubText}>Pickup lane: {airportPickupInfo.pickupLane.name}</Text> : null}
          {airportPickupInfo?.pickupLane?.message ? <Text style={styles.cardSubText}>{airportPickupInfo.pickupLane.message}</Text> : null}
          {airportPickupInfo?.message ? <Text style={styles.cardSubText}>{airportPickupInfo.message}</Text> : null}
          {airportPickupInfo.instructions.map(instruction => (
            <Text key={instruction} style={styles.cardSubText}>• {instruction}</Text>
          ))}
        </View>
      ) : null}

      {airportRestrictionMessage && !hasOrdTerminal5Restriction ? (
        <View style={[styles.card, styles.noticeCard]}>
          <Text style={styles.cardTitle}>Airport Status Signal</Text>
          <Text style={styles.cardSubTextStrong}>{airportRestrictionMessage}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dropoff</Text>
        <TextInput style={styles.input} value={dropoffAddress} onChangeText={setDropoffAddress} placeholder="Dropoff address" />
        <TextInput style={styles.input} value={dropoffLatitude} onChangeText={setDropoffLatitude} placeholder="Dropoff latitude" keyboardType="decimal-pad" />
        <TextInput style={styles.input} value={dropoffLongitude} onChangeText={setDropoffLongitude} placeholder="Dropoff longitude" keyboardType="decimal-pad" />
        <View style={styles.inlineButtonRow}>
          <Button title="Save Place" onPress={() => saveFavoriteLocation('dropoff', 'other')} />
          <Button title="Support" onPress={() => navigation.navigate('Support')} />
        </View>
      </View>

      {pricingLoading ? <ActivityIndicator /> : <Button title="Get Upfront Fare" onPress={loadUpfrontPricing} />}

      {upfrontPricing ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upfront Pricing</Text>
          <Text style={styles.cardSubText}>Category: {formatRideCategoryLabel(upfrontPricing.rideCategory || rideCategory)}</Text>
          <Text style={styles.cardSubTextStrong}>Final fare now: {formatMoney(upfrontPricing.upfrontFare)}</Text>
          <Text style={styles.cardSubText}>Estimated distance: {Number(upfrontPricing.distanceMiles || 0).toFixed(2)} miles</Text>
          <Text style={styles.cardSubText}>Estimated duration: {Number(upfrontPricing.durationMinutes || 0).toFixed(1)} min</Text>
          <Text style={styles.cardSubText}>Base fare: {formatMoney(upfrontPricing.baseFare)}</Text>
          <Text style={styles.cardSubText}>Distance charge: {formatMoney(upfrontPricing.distanceCharge)}</Text>
          <Text style={styles.cardSubText}>Time charge: {formatMoney(upfrontPricing.timeCharge)}</Text>
          <Text style={styles.cardSubText}>Service dog fee: {formatMoney(upfrontPricing.serviceDogFee || 0)}</Text>
          <Text style={styles.cardSubText}>Airport fee: {formatMoney(upfrontPricing.airportFee)}</Text>
          <Text style={styles.cardSubText}>Subtotal before surge: {formatMoney(upfrontPricing.subtotal)}</Text>
          {upfrontPricing.teenPickup ? (
            <Text style={styles.cardSubText}>Teen seating policy: {(upfrontPricing.teenSeatingPolicy || 'back seat only').replace(/_/g, ' ')}</Text>
          ) : null}

          <View style={styles.metricRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>Surge x{Number(upfrontPricing.surgeMultiplier || 1).toFixed(2)}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>Demand ratio {Number(upfrontPricing.demandRatio || 1).toFixed(2)}</Text>
            </View>
          </View>
          <Text style={styles.cardSubText}>Supply vs demand: {upfrontPricing.supplyCount || 0} drivers for {upfrontPricing.demandCount || 0} active requests.</Text>
          <Text style={styles.cardSubText}>Driver payout: {Number(upfrontPricing.driverSharePercent || 70).toFixed(0)}% | Platform: {Number(upfrontPricing.platformSharePercent || 30).toFixed(0)}%</Text>
          <Text style={styles.cardSubText}>Surge formula: {upfrontPricing.surgeTransparency?.formula || '1 + (demandRatio - 1) * sensitivity'}</Text>
          <Text style={styles.cardSubText}>Sensitivity: {Number(upfrontPricing.surgeTransparency?.sensitivity || upfrontPricing.surgeProfile?.sensitivity || 0).toFixed(2)} | Max: x{Number(upfrontPricing.surgeTransparency?.maxMultiplier || upfrontPricing.surgeProfile?.maxMultiplier || 0).toFixed(2)}</Text>
          <Text style={styles.helperText}>Transparent surge means you see what changed and why before you confirm.</Text>
        </View>
      ) : null}

      {loading ? <ActivityIndicator /> : <Button title="Request Ride" onPress={requestTrip} />}
    </ScrollView>
  );
}

type WaitingForDriverProps = NativeStackScreenProps<RootStackParamList, 'WaitingForDriver'> & {
  context: OnboardingContext;
};

function WaitingForDriverScreen({ navigation, route, context }: WaitingForDriverProps) {
  const [trip, setTrip] = useState<RiderTrip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [latestTripId, setLatestTripId] = useState(route.params?.tripId || '');

  const formatMoney = useCallback((value: number | null | undefined) => {
    if (!Number.isFinite(Number(value))) {
      return 'N/A';
    }

    return `$${Number(value).toFixed(2)}`;
  }, []);

  const loadActiveTrip = useCallback(async () => {
    if (!context.riderId) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const activeTripEndpoint = `${API_BASE_URL}/trips/rider/${context.riderId}/active`;
      const directTripEndpoint = latestTripId ? `${API_BASE_URL}/trips/${latestTripId}` : '';

      let response = directTripEndpoint ? await fetch(directTripEndpoint) : await fetch(activeTripEndpoint);
      let payload = await response.json();

      if (!response.ok && directTripEndpoint && response.status === 404) {
        response = await fetch(activeTripEndpoint);
        payload = await response.json();
      }

      if (!response.ok) {
        if (response.status === 404) {
          setTrip(null);
          setError('No active trip found. Request a new ride.');
          return;
        }

        throw new Error(payload.message || 'Failed to load active trip.');
      }

      setTrip(payload);
      if (payload?._id) {
        setLatestTripId(payload._id);
      }
    } catch (tripError: unknown) {
      const message = tripError instanceof Error ? tripError.message : 'Unable to fetch trip status.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [context.riderId, latestTripId]);

  useEffect(() => {
    loadActiveTrip();
    const intervalId = setInterval(loadActiveTrip, 4000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadActiveTrip]);

  const driverToPickupDistanceKm = useMemo(() => {
    if (!trip?.currentDriverLocation || !trip?.pickup) {
      return null;
    }

    return haversineDistanceKm(
      {
        latitude: trip.currentDriverLocation.latitude,
        longitude: trip.currentDriverLocation.longitude,
      },
      {
        latitude: trip.pickup.latitude,
        longitude: trip.pickup.longitude,
      }
    );
  }, [trip]);

  const pickupEtaMinutes = useMemo(() => {
    if (!driverToPickupDistanceKm) {
      return null;
    }

    return estimateEtaMinutes(driverToPickupDistanceKm, trip?.currentDriverLocation?.speedKph || 28);
  }, [driverToPickupDistanceKm, trip?.currentDriverLocation?.speedKph]);

  const driverVehicle = trip?.driver?.vehicle && typeof trip.driver.vehicle === 'object' ? trip.driver.vehicle : null;

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Driver Match</Text>
        <Text style={styles.heroTitle}>{trip ? trip.status.replace(/_/g, ' ') : 'waiting for trip'}</Text>
        <Text style={styles.heroSubText}>Pickup ETA: {formatEtaLabel(pickupEtaMinutes)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trip Snapshot</Text>
        <Text style={styles.cardSubText}>Category: {formatRideCategoryLabel(trip?.rideCategory || 'rydinex_regular')}</Text>
        <Text style={styles.cardSubText}>Service dog: {trip?.serviceDogRequested ? 'Yes' : 'No'}</Text>
        <Text style={styles.cardSubText}>Teen pickup: {trip?.teenPickup ? 'Yes (back seat only)' : 'No'}</Text>
        {trip?.specialInstructions ? <Text style={styles.cardSubText}>Notes: {trip.specialInstructions}</Text> : null}
        <Text style={styles.cardSubText}>Pickup: {trip?.pickup?.address || 'N/A'}</Text>
        <Text style={styles.cardSubText}>Dropoff: {trip?.dropoff?.address || 'N/A'}</Text>
        <Text style={styles.cardSubTextStrong}>Upfront fare: {formatMoney(trip?.upfrontFare ?? trip?.fareEstimate)}</Text>
        <Text style={styles.cardSubText}>Surge multiplier: x{Number(trip?.surgeMultiplier || 1).toFixed(2)}</Text>
        <Text style={styles.cardSubText}>Driver distance to pickup: {Number(driverToPickupDistanceKm || 0).toFixed(2)} km</Text>
        <Text style={styles.cardSubText}>
          Driver location:{' '}
          {trip?.currentDriverLocation
            ? `${trip.currentDriverLocation.latitude.toFixed(5)}, ${trip.currentDriverLocation.longitude.toFixed(5)}`
            : 'Waiting for route updates'}
        </Text>
        <Text style={styles.cardSubText}>Tracked distance: {Number(trip?.actualDistanceMiles || 0).toFixed(2)} mi</Text>
        <Text style={styles.cardSubText}>Trip duration: {Number(trip?.actualDurationMinutes || 0).toFixed(1)} min</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assigned Driver Identity</Text>
        <Text style={styles.cardSubTextStrong}>Name: {trip?.driver?.name || 'Searching for driver...'}</Text>
        <Text style={styles.cardSubText}>Phone: {trip?.driver?.phone || 'N/A'}</Text>
        <Text style={styles.cardSubText}>Driver profile status: {trip?.driver?.status || 'pending'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vehicle</Text>
        <Image source={{ uri: buildVehiclePhotoUrl(driverVehicle) }} style={styles.vehiclePhoto} resizeMode="cover" />
        <Text style={styles.cardSubTextStrong}>{buildVehicleLabel(driverVehicle)}</Text>
        <Text style={styles.cardSubText}>Color: {driverVehicle?.color || 'N/A'}</Text>
        <Text style={styles.cardSubText}>Plate: {driverVehicle?.plateNumber || 'N/A'}</Text>
      </View>

      <View style={styles.buttonStack}>
        <Button title="Refresh Trip Status" onPress={loadActiveTrip} />
        {trip?._id ? <Button title="Open Trip Progress" onPress={() => navigation.navigate('TripProgress', { tripId: trip._id })} /> : null}
        {trip?._id && trip.status === 'completed' ? <Button title="Open Receipt" onPress={() => navigation.navigate('Receipt', { tripId: trip._id })} /> : null}
        <Button title="Support" onPress={() => navigation.navigate('Support', { tripId: trip?._id })} />
        <Button title="Request Another Ride" onPress={() => navigation.navigate('RequestRide')} />
      </View>
    </ScrollView>
  );
}

type TripProgressProps = NativeStackScreenProps<RootStackParamList, 'TripProgress'> & {
  context: OnboardingContext;
};

function TripProgressScreen({ navigation, route }: TripProgressProps) {
  const { tripId } = route.params;

  const [trip, setTrip] = useState<RiderTrip | null>(null);
  const [tracking, setTracking] = useState<TripTrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatTime = useCallback((value?: string | null) => {
    if (!value) {
      return 'N/A';
    }

    return new Date(value).toLocaleTimeString();
  }, []);

  const loadProgress = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [tripResponse, trackingResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/trips/${tripId}`),
        fetch(`${API_BASE_URL}/trips/${tripId}/tracking?limit=200`),
      ]);

      const tripPayload = await tripResponse.json();
      const trackingPayload = await trackingResponse.json();

      if (!tripResponse.ok) {
        throw new Error(tripPayload.message || 'Failed to load trip progress.');
      }

      if (!trackingResponse.ok) {
        throw new Error(trackingPayload.message || 'Failed to load trip tracking.');
      }

      setTrip(tripPayload);
      setTracking(trackingPayload);
    } catch (progressError: unknown) {
      const message = progressError instanceof Error ? progressError.message : 'Unable to load trip progress.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadProgress();
    const intervalId = setInterval(loadProgress, 4000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadProgress]);

  const mapRegion: Region = {
    latitude: tracking?.currentDriverLocation?.latitude || trip?.pickup?.latitude || DEFAULT_REGION.latitude,
    longitude: tracking?.currentDriverLocation?.longitude || trip?.pickup?.longitude || DEFAULT_REGION.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const progressSteps = [
    'searching',
    'driver_assigned',
    'driver_accepted',
    'driver_arrived_pickup',
    'in_progress',
    'completed',
  ];

  const driverToDropoffDistanceKm = useMemo(() => {
    if (!tracking?.currentDriverLocation || !tracking?.dropoff) {
      return null;
    }

    return haversineDistanceKm(
      {
        latitude: tracking.currentDriverLocation.latitude,
        longitude: tracking.currentDriverLocation.longitude,
      },
      {
        latitude: tracking.dropoff.latitude,
        longitude: tracking.dropoff.longitude,
      }
    );
  }, [tracking]);

  const destinationEtaMinutes = useMemo(() => {
    if (!driverToDropoffDistanceKm) {
      return null;
    }

    return estimateEtaMinutes(driverToDropoffDistanceKm, tracking?.currentDriverLocation?.speedKph || 32);
  }, [driverToDropoffDistanceKm, tracking?.currentDriverLocation?.speedKph]);

  const driverVehicle = trip?.driver?.vehicle && typeof trip.driver.vehicle === 'object' ? trip.driver.vehicle : null;

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Trip Live</Text>
        <Text style={styles.heroTitle}>{trip?.status || tracking?.status || 'unknown status'}</Text>
        <Text style={styles.heroSubText}>ETA to destination: {formatEtaLabel(destinationEtaMinutes)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trip Progress</Text>
        <Text style={styles.cardSubText}>Category: {formatRideCategoryLabel(trip?.rideCategory || 'rydinex_regular')}</Text>
        <Text style={styles.cardSubText}>Service dog: {trip?.serviceDogRequested ? 'Yes' : 'No'}</Text>
        <Text style={styles.cardSubText}>Teen pickup: {trip?.teenPickup ? 'Yes (back seat only)' : 'No'}</Text>
        {trip?.specialInstructions ? <Text style={styles.cardSubText}>Notes: {trip.specialInstructions}</Text> : null}
        <Text style={styles.cardSubTextStrong}>Status: {trip?.status || tracking?.status || 'unknown'}</Text>
        <Text style={styles.cardSubText}>Driver: {trip?.driver?.name || tracking?.driver?.name || 'N/A'}</Text>
        <Text style={styles.cardSubText}>Driver phone: {trip?.driver?.phone || tracking?.driver?.phone || 'N/A'}</Text>
        <Text style={styles.cardSubText}>Distance: {Number(tracking?.actualDistanceMiles || trip?.actualDistanceMiles || 0).toFixed(2)} mi</Text>
        <Text style={styles.cardSubText}>Duration: {Number(tracking?.actualDurationMinutes || trip?.actualDurationMinutes || 0).toFixed(1)} min</Text>
        <Text style={styles.cardSubText}>Distance to dropoff: {Number(driverToDropoffDistanceKm || 0).toFixed(2)} km</Text>
        <Text style={styles.cardSubText}>Last driver ping: {formatTime(tracking?.currentDriverLocation?.recordedAt)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Driver And Vehicle</Text>
        <Image source={{ uri: buildVehiclePhotoUrl(driverVehicle) }} style={styles.vehiclePhoto} resizeMode="cover" />
        <Text style={styles.cardSubTextStrong}>{trip?.driver?.name || 'Driver'}</Text>
        <Text style={styles.cardSubText}>{buildVehicleLabel(driverVehicle)}</Text>
        <Text style={styles.cardSubText}>Plate: {driverVehicle?.plateNumber || 'N/A'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status Timeline</Text>
        {progressSteps.map(step => (
          <Text key={step} style={styles.cardSubText}>
            {step === (trip?.status || tracking?.status) ? '●' : '○'} {step}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Driver Tracking</Text>
        <View style={styles.mapContainer}>
          <MapView style={styles.map} region={mapRegion}>
            {tracking?.pickup ? (
              <Marker coordinate={{ latitude: tracking.pickup.latitude, longitude: tracking.pickup.longitude }} title="Pickup" />
            ) : null}
            {tracking?.dropoff ? (
              <Marker coordinate={{ latitude: tracking.dropoff.latitude, longitude: tracking.dropoff.longitude }} title="Dropoff" />
            ) : null}
            {tracking?.currentDriverLocation ? (
              <Marker
                coordinate={{
                  latitude: tracking.currentDriverLocation.latitude,
                  longitude: tracking.currentDriverLocation.longitude,
                }}
                title="Driver"
                pinColor="blue"
              />
            ) : null}
            {tracking?.routePoints?.length ? (
              <Polyline
                coordinates={tracking.routePoints.map(point => ({
                  latitude: point.latitude,
                  longitude: point.longitude,
                }))}
                strokeWidth={4}
                strokeColor="#2563eb"
              />
            ) : null}
          </MapView>
        </View>
      </View>

      <View style={styles.buttonStack}>
        <Button title="Refresh Progress" onPress={loadProgress} />
        {trip?.status === 'completed' ? <Button title="View Receipt" onPress={() => navigation.navigate('Receipt', { tripId })} /> : null}
        <Button title="Support" onPress={() => navigation.navigate('Support', { tripId })} />
      </View>
    </ScrollView>
  );
}

type ReceiptProps = NativeStackScreenProps<RootStackParamList, 'Receipt'> & {
  context: OnboardingContext;
};

type RatingSelectorProps = {
  label: string;
  value: number | null;
  onSelect: (rating: number) => void;
};

function RatingSelector({ label, value, onSelect }: RatingSelectorProps) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.ratingPillRow}>
        {[1, 2, 3, 4, 5].map(rating => {
          const isSelected = value === rating;

          return (
            <Pressable
              key={`${label}-${rating}`}
              onPress={() => onSelect(rating)}
              style={({ pressed }) => [
                styles.ratingPill,
                isSelected ? styles.ratingPillSelected : null,
                pressed ? styles.actionChipPressed : null,
              ]}
            >
              <Text style={[styles.ratingPillText, isSelected ? styles.ratingPillTextSelected : null]}>{rating}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ReceiptScreen({ route, navigation, context }: ReceiptProps) {
  const { tripId } = route.params;
  const [receipt, setReceipt] = useState<TripReceipt | null>(null);
  const [tipInput, setTipInput] = useState('');
  const [tipSubmitting, setTipSubmitting] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [driverProfessionalismRating, setDriverProfessionalismRating] = useState<number | null>(null);
  const [carCleanlinessRating, setCarCleanlinessRating] = useState<number | null>(null);
  const [amenitiesRating, setAmenitiesRating] = useState<number | null>(null);
  const [greetingRating, setGreetingRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [tipFeedbackMessage, setTipFeedbackMessage] = useState('');
  const [tipFeedbackTone, setTipFeedbackTone] = useState<'success' | 'neutral'>('success');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatMoney = useCallback((value: number | null | undefined) => {
    if (!Number.isFinite(Number(value))) {
      return 'N/A';
    }

    return `$${Number(value).toFixed(2)}`;
  }, []);

  const hydrateFeedbackState = useCallback((payload: TripReceipt) => {
    setOverallRating(normalizeOptionalRating(payload?.feedback?.overallRating));
    setDriverProfessionalismRating(normalizeOptionalRating(payload?.feedback?.driverProfessionalismRating));
    setCarCleanlinessRating(normalizeOptionalRating(payload?.feedback?.carCleanlinessRating));
    setAmenitiesRating(normalizeOptionalRating(payload?.feedback?.amenitiesRating));
    setGreetingRating(normalizeOptionalRating(payload?.feedback?.greetingRating));
    setFeedbackComment(String(payload?.feedback?.comments || ''));
  }, []);

  const loadReceipt = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      let response = await fetch(`${API_BASE_URL}/trips/${tripId}/receipt`);
      let payload = await response.json();

      if (!response.ok && response.status === 404) {
        response = await fetch(`${API_BASE_URL}/trips/${tripId}/receipt/generate`, {
          method: 'POST',
        });
        payload = await response.json();
      }

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load receipt.');
      }

      setReceipt(payload);
      const currentTip = Number(payload?.fare?.tipAmount || 0);
      setTipInput(currentTip > 0 ? currentTip.toFixed(2) : '');
      hydrateFeedbackState(payload);
    } catch (receiptError: unknown) {
      const message = receiptError instanceof Error ? receiptError.message : 'Unable to load receipt.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [hydrateFeedbackState, tripId]);

  useEffect(() => {
    loadReceipt();
  }, [loadReceipt]);

  const tipPresetOptions = useMemo(() => {
    if (Array.isArray(receipt?.tipPresetOptions) && receipt.tipPresetOptions.length > 0) {
      return receipt.tipPresetOptions
        .map(option => ({
          percent: Number(option?.percent),
          amount: Number(option?.amount),
        }))
        .filter(option => Number.isFinite(option.percent) && Number.isFinite(option.amount));
    }

    return buildTipPresetOptions(receipt?.fare?.finalFare);
  }, [receipt]);

  const tipPolicy = receipt?.tipPolicy;
  const tipWindowLabel = tipPolicy?.tipEditableUntil ? new Date(tipPolicy.tipEditableUntil).toLocaleString() : '';
  const tipWindowMessage =
    tipPolicy?.isUnlimitedTipWindow !== false
      ? 'Tip updates are available any time.'
      : tipWindowLabel
      ? `Tip can currently be updated until ${tipWindowLabel}.`
      : `Tip can be updated for ${Number(tipPolicy?.tipUpdateWindowHours ?? 24)} hour(s) after trip completion.`;

  const applyTip = useCallback(
    async (rawTipAmount: number) => {
      if (!context.riderId) {
        Alert.alert('Missing Rider', 'Please register before updating tip.');
        return;
      }

      const normalizedTipAmount = Number((Math.round((Number(rawTipAmount) + Number.EPSILON) * 100) / 100).toFixed(2));
      if (!Number.isFinite(normalizedTipAmount) || normalizedTipAmount < 0 || normalizedTipAmount > 1000) {
        Alert.alert('Invalid Tip', 'Tip must be between $0.00 and $1000.00.');
        return;
      }

      try {
        setTipSubmitting(true);
        setError('');

        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/tip`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            riderId: context.riderId,
            tipAmount: normalizedTipAmount,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          if (payload?.tipPolicy) {
            setReceipt(previousReceipt =>
              previousReceipt
                ? {
                    ...previousReceipt,
                    tipPolicy: payload.tipPolicy,
                  }
                : previousReceipt
            );
          }

          throw new Error(payload.message || 'Failed to update tip.');
        }

        if (payload.receipt) {
          setReceipt(payload.receipt);
        } else {
          await loadReceipt();
        }

        setTipInput(normalizedTipAmount > 0 ? normalizedTipAmount.toFixed(2) : '');

        if (normalizedTipAmount > 0) {
          setTipFeedbackTone('success');
          setTipFeedbackMessage(`Thanks for tipping ${formatMoney(normalizedTipAmount)}. Your driver receives 100%.`);
        } else {
          setTipFeedbackTone('neutral');
          setTipFeedbackMessage('Tip removed. You can add one again any time.');
        }
      } catch (tipError: unknown) {
        const message = tipError instanceof Error ? tipError.message : 'Failed to update tip.';
        setError(message);
        setTipFeedbackTone('neutral');
        setTipFeedbackMessage(message);
        Alert.alert('Tip Error', message);
      } finally {
        setTipSubmitting(false);
      }
    },
    [context.riderId, formatMoney, loadReceipt, tripId]
  );

  const applyCustomTip = useCallback(() => {
    const sanitized = tipInput.replace(/[^0-9.]/g, '');
    const parsedTip = Number(sanitized);

    if (!sanitized || !Number.isFinite(parsedTip)) {
      Alert.alert('Invalid Tip', 'Enter a valid tip amount, for example 12.50.');
      return;
    }

    applyTip(parsedTip);
  }, [applyTip, tipInput]);

  const submitFeedback = useCallback(async () => {
    if (!context.riderId) {
      Alert.alert('Missing Rider', 'Please register before submitting feedback.');
      return;
    }

    const hasAnyRating =
      overallRating !== null ||
      driverProfessionalismRating !== null ||
      carCleanlinessRating !== null ||
      amenitiesRating !== null ||
      greetingRating !== null;

    const trimmedComment = feedbackComment.trim();

    if (!hasAnyRating && !trimmedComment) {
      Alert.alert('Feedback Required', 'Please provide at least one rating category or a comment.');
      return;
    }

    const payload: Record<string, unknown> = {
      riderId: context.riderId,
    };

    if (overallRating !== null) {
      payload.overallRating = overallRating;
    }

    if (driverProfessionalismRating !== null) {
      payload.driverProfessionalismRating = driverProfessionalismRating;
    }

    if (carCleanlinessRating !== null) {
      payload.carCleanlinessRating = carCleanlinessRating;
    }

    if (amenitiesRating !== null) {
      payload.amenitiesRating = amenitiesRating;
    }

    if (greetingRating !== null) {
      payload.greetingRating = greetingRating;
    }

    if (trimmedComment) {
      payload.comments = trimmedComment;
    }

    try {
      setFeedbackSubmitting(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responsePayload = await response.json();

      if (!response.ok) {
        throw new Error(responsePayload.message || 'Failed to submit trip feedback.');
      }

      if (responsePayload?.receipt) {
        setReceipt(responsePayload.receipt);
        const currentTip = Number(responsePayload.receipt?.fare?.tipAmount || 0);
        setTipInput(currentTip > 0 ? currentTip.toFixed(2) : '');
        hydrateFeedbackState(responsePayload.receipt);
      } else {
        await loadReceipt();
      }

      setTipFeedbackTone('success');
      setTipFeedbackMessage('Thanks for rating your trip. You can update your feedback any time.');
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to submit trip feedback.';
      setError(message);
      setTipFeedbackTone('neutral');
      setTipFeedbackMessage(message);
      Alert.alert('Feedback Error', message);
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [
    amenitiesRating,
    carCleanlinessRating,
    context.riderId,
    driverProfessionalismRating,
    feedbackComment,
    greetingRating,
    hydrateFeedbackState,
    loadReceipt,
    overallRating,
    tripId,
  ]);

  const currentTipAmount = Number(receipt?.fare?.tipAmount || 0);
  const feedbackUpdatedAt = receipt?.feedback?.updatedAt || receipt?.feedback?.submittedAt;

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Trip Receipt</Text>
        <Text style={styles.heroTitle}>Your fare is final and itemized</Text>
        <Text style={styles.heroSubText}>See every charge with full surge and commission transparency.</Text>
      </View>

      {tipFeedbackMessage ? (
        <View style={[styles.card, tipFeedbackTone === 'success' ? styles.successNoticeCard : styles.noticeCard]}>
          <Text style={styles.cardSubTextStrong}>{tipFeedbackMessage}</Text>
        </View>
      ) : null}

      {receipt ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Receipt #{receipt.receiptId}</Text>
          <Text style={styles.cardSubText}>Generated: {new Date(receipt.generatedAt).toLocaleString()}</Text>
          <Text style={styles.cardSubText}>Trip status: {receipt.trip?.status || 'N/A'}</Text>
          <Text style={styles.cardSubText}>Pickup: {receipt.trip?.pickup?.address || 'N/A'}</Text>
          <Text style={styles.cardSubText}>Dropoff: {receipt.trip?.dropoff?.address || 'N/A'}</Text>
          <Text style={styles.cardSubText}>Distance: {Number(receipt.trip?.distanceMiles || 0).toFixed(2)} mi</Text>
          <Text style={styles.cardSubText}>Duration: {Number(receipt.trip?.durationMinutes || 0).toFixed(1)} min</Text>

          <Text style={styles.cardTitle}>Fare Breakdown</Text>
          <Text style={styles.cardSubText}>Upfront fare: {formatMoney(receipt.fare?.upfrontFare)}</Text>
          <Text style={styles.cardSubTextStrong}>Final fare: {formatMoney(receipt.fare?.finalFare)}</Text>
          <Text style={styles.cardSubText}>Service dog fee: {formatMoney(receipt.fare?.serviceDogFee || 0)}</Text>
          <Text style={styles.cardSubText}>Tip: {formatMoney(receipt.fare?.tipAmount)}</Text>
          <Text style={styles.cardSubTextStrong}>
            Total charged: {formatMoney(receipt.fare?.totalCharged ?? Number(receipt.fare?.finalFare || 0) + Number(receipt.fare?.tipAmount || 0))}
          </Text>
          <Text style={styles.cardSubText}>Surge multiplier: x{Number(receipt.fare?.surgeMultiplier || 1).toFixed(2)}</Text>
          <Text style={styles.cardSubText}>Platform commission: {formatMoney(receipt.fare?.platformCommission)}</Text>
          <Text style={styles.cardSubText}>Driver earnings: {formatMoney(receipt.fare?.driverEarnings)}</Text>
          <Text style={styles.cardSubTextStrong}>
            Driver earnings incl. tip: {formatMoney(receipt.fare?.driverTotalEarnings ?? Number(receipt.fare?.driverEarnings || 0) + Number(receipt.fare?.tipAmount || 0))}
          </Text>
        </View>
      ) : null}

      {receipt ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tip Your Driver</Text>
          <Text style={styles.cardSubText}>100% of your tip goes directly to the driver.</Text>
          <Text style={styles.cardSubText}>{tipWindowMessage}</Text>

          <View style={styles.actionGrid}>
            {tipPresetOptions.map(option => {
              const isSelected = Math.abs(currentTipAmount - option.amount) < 0.01;

              return (
                <Pressable
                  key={`tip-${option.percent}`}
                  onPress={() => applyTip(option.amount)}
                  disabled={tipSubmitting || loading}
                  style={({ pressed }) => [
                    styles.actionChip,
                    isSelected ? styles.actionChipSelected : null,
                    pressed ? styles.actionChipPressed : null,
                  ]}
                >
                  <Text style={styles.actionChipText}>{option.percent}% ({formatMoney(option.amount)})</Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => applyTip(0)}
              disabled={tipSubmitting || loading}
              style={({ pressed }) => [
                styles.actionChip,
                Math.abs(currentTipAmount) < 0.01 ? styles.actionChipSelected : null,
                pressed ? styles.actionChipPressed : null,
              ]}
            >
              <Text style={styles.actionChipText}>No Tip</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            value={tipInput}
            onChangeText={setTipInput}
            placeholder="Custom tip amount"
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            editable={!tipSubmitting && !loading}
          />

          <View style={styles.buttonStack}>
            <Button
              title={tipSubmitting ? 'Updating Tip...' : 'Apply Custom Tip'}
              onPress={applyCustomTip}
              disabled={tipSubmitting || loading}
            />
          </View>
        </View>
      ) : null}

      {receipt ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rate Your Driver</Text>
          <Text style={styles.cardSubText}>Professionalism, cleanliness, amenities, and greeting all matter.</Text>

          <RatingSelector label="Overall" value={overallRating} onSelect={setOverallRating} />
          <RatingSelector
            label="Professionalism"
            value={driverProfessionalismRating}
            onSelect={setDriverProfessionalismRating}
          />
          <RatingSelector
            label="Car Cleanliness"
            value={carCleanlinessRating}
            onSelect={setCarCleanlinessRating}
          />
          <RatingSelector label="Amenities" value={amenitiesRating} onSelect={setAmenitiesRating} />
          <RatingSelector label="Greeting" value={greetingRating} onSelect={setGreetingRating} />

          <TextInput
            style={[styles.input, styles.feedbackCommentInput]}
            value={feedbackComment}
            onChangeText={setFeedbackComment}
            placeholder="Optional comment"
            multiline
            numberOfLines={3}
          />

          <View style={styles.buttonStack}>
            <Button
              title={feedbackSubmitting ? 'Saving Feedback...' : 'Submit Driver Feedback'}
              onPress={submitFeedback}
              disabled={feedbackSubmitting || loading}
            />
          </View>

          {feedbackUpdatedAt ? <Text style={styles.cardSubText}>Last updated: {new Date(feedbackUpdatedAt).toLocaleString()}</Text> : null}
        </View>
      ) : null}

      <View style={styles.buttonStack}>
        <Button title="Refresh Receipt" onPress={loadReceipt} />
        <Button title="Support" onPress={() => navigation.navigate('Support', { tripId })} />
      </View>
    </ScrollView>
  );
}

type SupportProps = NativeStackScreenProps<RootStackParamList, 'Support'> & {
  context: OnboardingContext;
};

function SupportScreen({ route, navigation, context }: SupportProps) {
  const [category, setCategory] = useState('trip_issue');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [subject, setSubject] = useState('Need help with my ride');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitSupportRequest = useCallback(async () => {
    if (!context.riderId) {
      Alert.alert('Missing Rider', 'Please register before opening a support ticket.');
      return;
    }

    if (!category.trim() || !subject.trim() || !description.trim()) {
      Alert.alert('Validation', 'Category, subject, and description are required.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category.trim(),
          subject: subject.trim(),
          description: description.trim(),
          tripId: route.params?.tripId || undefined,
          riderId: context.riderId,
          submittedByType: 'rider',
          submittedById: context.riderId,
          priority,
          metadata: {
            source: 'rider_app',
            createdAtClient: new Date().toISOString(),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to submit support request.');
      }

      Alert.alert('Support request sent', 'Our team has received your request and will follow up shortly.');
      navigation.goBack();
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to submit support request.';
      Alert.alert('Support error', message);
    } finally {
      setSubmitting(false);
    }
  }, [category, context.riderId, description, navigation, priority, route.params?.tripId, subject]);

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Rider Support</Text>
        <Text style={styles.heroTitle}>Fast, human support</Text>
        <Text style={styles.heroSubText}>Share the issue and our team gets a triaged ticket immediately.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Issue Details</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Category (example: trip_issue)" autoCapitalize="none" />
        <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject" />
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what happened"
          multiline
          numberOfLines={4}
        />

        <View style={styles.inlineButtonRow}>
          <Button title="Low" onPress={() => setPriority('low')} />
          <Button title="Medium" onPress={() => setPriority('medium')} />
          <Button title="High" onPress={() => setPriority('high')} />
          <Button title="Urgent" onPress={() => setPriority('urgent')} />
        </View>

        <Text style={styles.cardSubText}>Selected priority: {priority}</Text>
      </View>

      {submitting ? <ActivityIndicator /> : <Button title="Submit Support Request" onPress={submitSupportRequest} />}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.background,
  },
  screenContainer: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
    paddingBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    color: PREMIUM_COLORS.textPrimary,
  },
  helperText: {
    fontSize: 13,
    color: PREMIUM_COLORS.textSecondary,
  },
  errorText: {
    color: PREMIUM_COLORS.danger,
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.divider,
    borderRadius: 14,
    padding: 14,
    backgroundColor: PREMIUM_COLORS.card,
    shadowColor: PREMIUM_COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: PREMIUM_COLORS.accent,
    shadowColor: PREMIUM_COLORS.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 3,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dbeafe',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  heroSubText: {
    color: '#e0ecff',
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    color: PREMIUM_COLORS.textPrimary,
  },
  cardSubText: {
    fontSize: 14,
    color: PREMIUM_COLORS.textSecondary,
    marginBottom: 4,
  },
  cardSubTextStrong: {
    fontSize: 14,
    color: PREMIUM_COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeCard: {
    backgroundColor: PREMIUM_COLORS.warningSoft,
  },
  criticalNoticeCard: {
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  criticalNoticeText: {
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '700',
    marginBottom: 4,
  },
  successNoticeCard: {
    backgroundColor: PREMIUM_COLORS.successSoft,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: PREMIUM_COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionChipPressed: {
    opacity: 0.75,
  },
  actionChipSelected: {
    borderColor: PREMIUM_COLORS.accent,
    backgroundColor: '#d6e8ff',
  },
  actionChipText: {
    color: PREMIUM_COLORS.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  ratingRow: {
    marginTop: 8,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
    marginBottom: 6,
  },
  ratingPillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  ratingPill: {
    minWidth: 32,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.divider,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  ratingPillSelected: {
    borderColor: PREMIUM_COLORS.accent,
    backgroundColor: PREMIUM_COLORS.accentSoft,
  },
  ratingPillText: {
    color: PREMIUM_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  ratingPillTextSelected: {
    color: PREMIUM_COLORS.accent,
  },
  feedbackCommentInput: {
    marginTop: 10,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metricPill: {
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricPillOnline: {
    backgroundColor: PREMIUM_COLORS.successSoft,
  },
  metricPillOffline: {
    backgroundColor: '#fff1f2',
  },
  metricPillText: {
    color: PREMIUM_COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
  buttonStack: {
    gap: 8,
  },
  favoriteItem: {
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.divider,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fafcff',
    marginTop: 8,
  },
  inlineButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  vehiclePhoto: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#dbe7f5',
  },
  mapContainer: {
    height: 260,
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.divider,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default App;


