import 'react-native-gesture-handler';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Button,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import Geolocation from '@react-native-community/geolocation';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from './src/config/network';

type RootStackParamList = {
  Registration: undefined;
  DocumentUpload: undefined;
  VehicleInfo: undefined;
  PendingApproval: undefined;
  IncomingRequests: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type DriverCoordinates = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  recordedAt?: number;
};

const MAX_RELIABLE_GPS_ACCURACY_METERS = 70;
const MIN_HEARTBEAT_DISTANCE_METERS = 8;
const MIN_HEARTBEAT_INTERVAL_MS = 2500;
const MIN_QUEUE_REFRESH_INTERVAL_MS = 12000;
const QUEUE_ACTION_DEBOUNCE_MS = 1800;
const QUEUE_ACTION_RETRY_DELAYS_MS = [700, 1400];
const MAX_SHIFT_DRIVING_HOURS = 12;
const MAX_SHIFT_DRIVING_MS = MAX_SHIFT_DRIVING_HOURS * 60 * 60 * 1000;
const DESTINATION_KEY_DAILY_LIMIT = 2;

const AIRPORT_OPPORTUNITY_WINDOWS = [
  {
    airportCode: 'ORD',
    airportName: 'O Hare International',
    label: 'Morning Flight Bank',
    hours: '05:00 - 09:00',
  },
  {
    airportCode: 'ORD',
    airportName: 'O Hare International',
    label: 'Evening Flight Bank',
    hours: '16:30 - 21:00',
  },
  {
    airportCode: 'MDW',
    airportName: 'Midway International',
    label: 'Business Return Window',
    hours: '15:30 - 19:30',
  },
  {
    airportCode: 'MDW',
    airportName: 'Midway International',
    label: 'Early Departure Wave',
    hours: '04:30 - 07:30',
  },
] as const;

const ORD_QUEUE_LOTS = [
  {
    name: 'ORD Limo Lot',
    category: 'Rydinex Black/SUV',
    driverType: 'Black Car',
  },
  {
    name: 'ORD Alpha Waiting Lot',
    category: 'Standard',
    driverType: 'Regular drivers',
  },
  {
    name: 'ORD Delta Overflow Lot',
    category: 'Standard',
    driverType: 'Regular drivers',
  },
] as const;

const AIRPORT_EARNING_HOTSPOTS = [
  {
    id: 'ord-hotspot',
    label: 'ORD Limo Lot (Black/SUV)',
    query: 'ORD limo lot black SUV',
  },
  {
    id: 'mdw-hotspot',
    label: 'MDW Ride App Pickup Zone',
    query: 'MDW ride app pickup zone',
  },
] as const;

const BREAK_SPOT_QUICK_ACTIONS = [
  {
    id: 'bathroom',
    label: 'Bathroom',
    query: 'nearest restroom',
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    query: 'nearest restaurant',
  },
  {
    id: 'gas-station',
    label: 'Gas Station',
    query: 'nearest gas station',
  },
] as const;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceBetweenMeters(source: DriverCoordinates, target: DriverCoordinates) {
  const earthRadiusMeters = 6371_000;

  const latitudeDelta = toRadians(target.latitude - source.latitude);
  const longitudeDelta = toRadians(target.longitude - source.longitude);
  const sourceLatitudeRadians = toRadians(source.latitude);
  const targetLatitudeRadians = toRadians(target.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2) * Math.cos(sourceLatitudeRadians) * Math.cos(targetLatitudeRadians);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function deriveGpsQuality(accuracyMeters: number | null) {
  if (!Number.isFinite(Number(accuracyMeters))) {
    return 'Unknown';
  }

  if (Number(accuracyMeters) <= 12) {
    return 'Excellent';
  }

  if (Number(accuracyMeters) <= 30) {
    return 'Good';
  }

  if (Number(accuracyMeters) <= MAX_RELIABLE_GPS_ACCURACY_METERS) {
    return 'Fair';
  }

  return 'Poor';
}

function shouldEmitLocationUpdate(
  previous: DriverCoordinates | null,
  next: DriverCoordinates,
  options = {
    minDistanceMeters: MIN_HEARTBEAT_DISTANCE_METERS,
    minIntervalMs: MIN_HEARTBEAT_INTERVAL_MS,
  }
) {
  if (!previous) {
    return true;
  }

  const previousRecordedAt = Number(previous.recordedAt || 0);
  const nextRecordedAt = Number(next.recordedAt || Date.now());

  const elapsedMs = Math.max(nextRecordedAt - previousRecordedAt, 0);
  const movedMeters = distanceBetweenMeters(previous, next);

  if (movedMeters >= options.minDistanceMeters) {
    return true;
  }

  if (elapsedMs >= options.minIntervalMs) {
    return true;
  }

  return false;
}

function waitFor(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}

type DriverAirportQueueStatus = {
  driverId: string;
  queueGroup: 'regular' | 'black_car';
  isInAirportLot: boolean;
  detectedAirport: {
    code: 'ORD' | 'MDW';
    name: string;
  } | null;
  detectedAirportLot: {
    queueGroup: 'regular' | 'black_car';
    lotCode: string;
    lotName: string;
    inRequiredLot: boolean;
  } | null;
  pickupZone: {
    code: string;
    name: string;
    laneType: 'regular' | 'black_car';
  } | null;
  isInEventVenue: boolean;
  detectedEvent: {
    code: 'UNITED_CENTER' | 'WRIGLEY_FIELD' | 'SOLDIER_FIELD';
    name: string;
    queueOpen: boolean;
  } | null;
  eventStagingArea: {
    queueGroup: 'regular' | 'black_car';
    code: string;
    name: string;
    inRequiredStagingArea: boolean;
    queueOpen: boolean;
  } | null;
  eventPickupLane: {
    code: string;
    name: string;
    laneType: 'regular' | 'black_car';
  } | null;
  queueEntry: {
    id: string;
    driverId?: string;
    queueType: 'airport' | 'event';
    queueGroup: 'regular' | 'black_car';
    airportCode: 'ORD' | 'MDW' | null;
    eventCode: 'UNITED_CENTER' | 'WRIGLEY_FIELD' | 'SOLDIER_FIELD' | null;
    lotCode: string | null;
    stagingAreaCode: string | null;
    pickupZoneCode: string | null;
    status: 'waiting' | 'assigned' | 'exited';
    position: number | null;
    estimatedWaitMinutes: number | null;
    joinedAt?: string;
    assignedTrip?: string | null;
    assignedAt?: string | null;
    exitedAt?: string | null;
    exitReason?: string | null;
    expiresAt?: string | null;
    lastKnownLocation?: {
      latitude: number;
      longitude: number;
      recordedAt?: string;
    } | null;
  } | null;
  enforcement?: {
    airportQueueStrict: boolean;
    eventQueueStrict: boolean;
  };
};

type TripPoint = {
  latitude: number;
  longitude: number;
  address?: string;
};

type DriverTrip = {
  _id: string;
  serviceDogRequested?: boolean;
  serviceDogFee?: number | null;
  teenPickup?: boolean;
  teenSeatingPolicy?: 'none' | 'back_seat_only' | string;
  specialInstructions?: string;
  rider?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  pickup: TripPoint;
  dropoff: TripPoint;
  status: string;
  fareEstimate?: number | null;
  upfrontFare?: number | null;
  surgeMultiplier?: number | null;
  driverEarnings?: number | null;
  platformCommission?: number | null;
  currency?: string;
  actualDistanceKm?: number | null;
  actualDistanceMiles?: number | null;
  actualDurationMinutes?: number | null;
  currentDriverLocation?: {
    latitude: number;
    longitude: number;
    speedKph?: number | null;
    recordedAt?: string;
  } | null;
  receipt?: {
    receiptId?: string;
  } | null;
  createdAt?: string;
};

type DriverTripPreferences = {
  serviceDogEnabled: boolean;
  teenPickupEnabled: boolean;
};

type DriverSurgeForecastPoint = {
  minutesAhead: number;
  projectedMultiplier: number;
  confidence: 'high' | 'medium' | 'low';
  trend: 'rising' | 'stable' | 'cooling';
};

type DriverSurgeVisibility = {
  rideCategory?: 'black_car' | 'suv';
  surgeMultiplier: number;
  demandRatio: number;
  demandCount: number;
  supplyCount: number;
  surgeRadiusKm: number;
  trend: 'rising' | 'stable' | 'cooling';
  sensitivity?: number;
  maxMultiplier?: number;
  transparency?: {
    formula?: string;
    sensitivity?: number;
    maxMultiplier?: number;
    rawMultiplier?: number;
    appliedMultiplier?: number;
  };
  categories?: {
    black_car?: {
      surgeMultiplier: number;
      sensitivity: number;
      maxMultiplier: number;
    };
    suv?: {
      surgeMultiplier: number;
      sensitivity: number;
      maxMultiplier: number;
    };
  };
  forecast: DriverSurgeForecastPoint[];
  generatedAt?: string;
};

type ChauffeurLicenseProfile = {
  licenseNumber?: string | null;
  issuingState?: string | null;
  status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verifiedAt?: string | null;
  expiresAt?: string | null;
  verificationNotes?: string;
};

type MultiStateRule = {
  code: string;
  name: string;
  chauffeurLicenseRequired: boolean;
  vehicleInspectionIntervalDays: number;
  backgroundCheckRenewalDays: number;
  requiredDocuments: string[];
  notes: string[];
};

type MultiStateRulesProfile = {
  operatingStates: string[];
  unsupportedStates?: string[];
  requiresChauffeurLicense: boolean;
  rules: MultiStateRule[];
  chauffeurLicenseStatus?: string;
};

type WeeklyPayoutItem = {
  weekStart: string;
  weekEnd: string;
  payoutScheduledAt: string;
  payoutStatus: 'scheduled' | 'processing' | 'paid';
  tripCount: number;
  grossFare: number;
  platformCommission: number;
  driverEarnings: number;
};

type WeeklyPayoutResponse = {
  currency: string;
  weeksRequested: number;
  payoutDelayDays: number;
  weekly: WeeklyPayoutItem[];
  totals: {
    grossFare: number;
    platformCommission: number;
    driverEarnings: number;
    tripCount: number;
  };
  nextPayout?: WeeklyPayoutItem | null;
};

type TripEarningsItem = {
  tripId: string;
  completedAt?: string;
  pickup?: TripPoint;
  dropoff?: TripPoint;
  surgeMultiplier?: number;
  grossFare: number;
  platformCommission: number;
  driverEarnings: number;
  currency?: string;
  actualDistanceMiles?: number;
  actualDurationMinutes?: number;
};

type TripEarningsResponse = {
  currency: string;
  count: number;
  earnings: TripEarningsItem[];
  totals: {
    grossFare: number;
    platformCommission: number;
    driverEarnings: number;
  };
};

type RydineXProTier = 'blue' | 'gold' | 'platinum';

type DriverProStatusResponse = {
  driverId: string;
  lookbackDays: number;
  completedTrips: number;
  averageRiderRating: number | null;
  ratingsReceived: number;
  driverEarnings: number;
  currency: string;
  currentTier: {
    code: RydineXProTier;
    label: string;
  };
  nextTier: {
    code: RydineXProTier;
    label: string;
    minTrips: number;
    minRating: number;
  } | null;
  tripProgressPercent: number;
  tripsToNextTier: number;
  ratingNeededForNextTier: number;
  perks: string[];
  rewards: string[];
};

type DestinationKeyUsage = {
  destination: string;
  usedAt: number;
};

type DriverRiderFeedbackForm = {
  overallRating: string;
  safetyRating: string;
  respectRating: string;
  comments: string;
};

function toDateKey(input: Date = new Date()) {
  return input.toISOString().slice(0, 10);
}

function clampRatingInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 5) {
    return null;
  }

  return rounded;
}

function formatMaskedCurrency(value: number | null | undefined, isVisible: boolean) {
  if (!isVisible) {
    return '***';
  }

  if (!Number.isFinite(Number(value))) {
    return 'N/A';
  }

  return `$${Number(value).toFixed(2)}`;
}

const DRIVER_COLORS = {
  background: '#131314',
  surface: '#1f1f20',
  surfaceHigh: '#2a2a2b',
  surfaceHighest: '#353436',
  textPrimary: '#e5e2e3',
  textSecondary: '#c2c6d7',
  accent: '#276ef1',
  accentSoft: '#31477c',
  divider: '#424654',
  successSoft: '#163828',
  successText: '#b7f7cf',
  dangerSoft: '#492525',
  dangerText: '#ffb4ab',
  neutralSoft: '#303031',
  shadow: '#000000',
};

function getProTierChipStyle(tier: RydineXProTier | null | undefined) {
  if (tier === 'platinum') {
    return {
      backgroundColor: '#e5e7eb',
      color: '#111827',
    };
  }

  if (tier === 'gold') {
    return {
      backgroundColor: '#fef3c7',
      color: '#92400e',
    };
  }

  return {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  };
}

function App() {
  const [driverId, setDriverId] = useState('');

  const contextValue = useMemo(
    () => ({
      driverId,
      setDriverId,
    }),
    [driverId]
  );

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Registration">
          <Stack.Screen name="Registration" options={{ title: 'Driver Access' }}>
            {props => <RegistrationScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="DocumentUpload" options={{ title: 'Upload Documents' }}>
            {props => <DocumentUploadScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="VehicleInfo" options={{ title: 'Vehicle Info' }}>
            {props => <VehicleInfoScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="PendingApproval" options={{ title: 'Approval Status' }}>
            {props => <PendingApprovalScreen {...props} context={contextValue} />}
          </Stack.Screen>
          <Stack.Screen name="IncomingRequests" options={{ title: 'Incoming Requests' }}>
            {props => <IncomingRequestsScreen {...props} context={contextValue} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

type OnboardingContext = {
  driverId: string;
  setDriverId: (value: string) => void;
};

type RegistrationProps = NativeStackScreenProps<RootStackParamList, 'Registration'> & {
  context: OnboardingContext;
};

function RegistrationScreen({ navigation, context }: RegistrationProps) {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [driverType, setDriverType] = useState<'standard' | 'professional'>('standard');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submitDriverAccess = useCallback(async () => {
    const requiresRegistrationFields = !isLoginMode;
    if (!email || !password || (requiresRegistrationFields && (!name || !phone))) {
      Alert.alert('Validation', isLoginMode ? 'Please enter email and password.' : 'Please fill in all required fields.');
      return;
    }

    try {
      setLoading(true);
      const endpoint = isLoginMode ? '/drivers/login' : '/drivers/register';
      const requestBody = isLoginMode
        ? { email, password }
        : { name, phone, email, password, driverType };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || (isLoginMode ? 'Login failed.' : 'Registration failed.'));
      }

      const resolvedDriverId = payload?.driver?.id;
      if (!resolvedDriverId) {
        throw new Error('Driver account response is missing the driver id.');
      }

      context.setDriverId(resolvedDriverId);
      if (isLoginMode) {
        // Always land on the operational dashboard first (online toggle, map shortcuts, airport queue).
        navigation.navigate('PendingApproval');
        return;
      }

      navigation.navigate('DocumentUpload');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Unable to ${isLoginMode ? 'sign in' : 'register driver'}.`;
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [context, driverType, email, isLoginMode, name, navigation, password, phone]);

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      <Text style={styles.helperNote}>
        {isLoginMode
          ? 'Sign in with your existing driver account.'
          : 'Create a new driver account to start onboarding.'}
      </Text>
      {!isLoginMode ? <TextInput style={styles.input} placeholder="Full name" value={name} onChangeText={setName} /> : null}
      {!isLoginMode ? (
        <View style={styles.queueActionsRow}>
          <View style={styles.tripActionButton}>
            <Button title="Standard" onPress={() => setDriverType('standard')} />
          </View>
          <View style={styles.tripActionButton}>
            <Button title="Professional" onPress={() => setDriverType('professional')} />
          </View>
        </View>
      ) : null}
      {!isLoginMode ? <Text style={styles.helperNote}>Driver type: {driverType.toUpperCase()}</Text> : null}
      {!isLoginMode ? (
        <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      ) : null}
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {loading ? <ActivityIndicator /> : <Button title={isLoginMode ? 'Sign In' : 'Register'} onPress={submitDriverAccess} />}
      <Button
        title={isLoginMode ? 'Need a new account? Register' : 'Already have an account? Sign In'}
        onPress={() => setIsLoginMode(previous => !previous)}
      />
    </ScrollView>
  );
}

type DocumentUploadProps = NativeStackScreenProps<RootStackParamList, 'DocumentUpload'> & {
  context: OnboardingContext;
};

function DocumentUploadScreen({ navigation, context }: DocumentUploadProps) {
  const [docType, setDocType] = useState('license');
  const [expiresAt, setExpiresAt] = useState('');
  const [inspectionCenter, setInspectionCenter] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [taxLegalName, setTaxLegalName] = useState('');
  const [taxTinLast4, setTaxTinLast4] = useState('');
  const [taxAddress, setTaxAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [inspectionLoading, setInspectionLoading] = useState(false);

  const pickDocument = useCallback(async () => {
    const [picked] = await pick({ type: [types.allFiles] });
    return picked;
  }, []);

  const uploadDocument = useCallback(async () => {
    if (!context.driverId) {
      Alert.alert('Missing Driver', 'Please complete registration first.');
      return;
    }

    try {
      setLoading(true);
      const picked = await pickDocument();
      const formData = new FormData();

      formData.append('docType', docType);
      if (expiresAt.trim()) {
        formData.append('expiresAt', expiresAt.trim());
      }
      formData.append('document', {
        uri: picked.uri,
        type: picked.type || 'application/octet-stream',
        name: picked.name || 'document',
      } as any);

      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/documents`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Document upload failed.');
      }

      Alert.alert('Success', `${docType} uploaded successfully.`);
    } catch (error: unknown) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to upload document.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [context.driverId, docType, expiresAt, pickDocument]);

  const uploadVehicleInspection = useCallback(async () => {
    if (!context.driverId) {
      Alert.alert('Missing Driver', 'Please complete registration first.');
      return;
    }

    try {
      setInspectionLoading(true);
      const picked = await pickDocument();
      const formData = new FormData();

      if (expiresAt.trim()) {
        formData.append('expiresAt', expiresAt.trim());
      }

      if (inspectionCenter.trim()) {
        formData.append('inspectionCenter', inspectionCenter.trim());
      }

      if (inspectionNotes.trim()) {
        formData.append('notes', inspectionNotes.trim());
      }

      formData.append('document', {
        uri: picked.uri,
        type: picked.type || 'application/octet-stream',
        name: picked.name || 'vehicle-inspection',
      } as any);

      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/vehicle-inspection`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Vehicle inspection upload failed.');
      }

      Alert.alert('Success', 'Vehicle inspection uploaded and pending review.');
    } catch (error: unknown) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to upload vehicle inspection.';
      Alert.alert('Error', message);
    } finally {
      setInspectionLoading(false);
    }
  }, [context.driverId, expiresAt, inspectionCenter, inspectionNotes, pickDocument]);

  const saveTaxProfile = useCallback(() => {
    if (!taxLegalName.trim()) {
      Alert.alert('Tax Info', 'Legal name is required for tax profile setup.');
      return;
    }

    if (taxTinLast4 && !/^\d{4}$/.test(taxTinLast4.trim())) {
      Alert.alert('Tax Info', 'TIN last 4 must be exactly 4 digits.');
      return;
    }

    Alert.alert('Saved', 'Tax profile saved. You can update it anytime before payout.');
  }, [taxLegalName, taxTinLast4]);

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      <Text style={styles.label}>Document Type</Text>
      <TextInput
        style={styles.input}
        placeholder="license, insurance, vehicle_registration, chauffeur_license"
        value={docType}
        onChangeText={setDocType}
      />
      <TextInput
        style={styles.input}
        placeholder="Optional expiry date (YYYY-MM-DD)"
        value={expiresAt}
        onChangeText={setExpiresAt}
        autoCapitalize="none"
      />
      {loading ? <ActivityIndicator /> : <Button title="Choose & Upload Document" onPress={uploadDocument} />}

      <View style={styles.queueCard}>
        <Text style={styles.queueTitle}>Tax Information</Text>
        <TextInput
          style={styles.input}
          placeholder="Legal name for 1099"
          value={taxLegalName}
          onChangeText={setTaxLegalName}
        />
        <TextInput
          style={styles.input}
          placeholder="TIN last 4 (optional)"
          value={taxTinLast4}
          onChangeText={setTaxTinLast4}
          keyboardType="number-pad"
          maxLength={4}
        />
        <TextInput
          style={styles.input}
          placeholder="Tax mailing address (optional)"
          value={taxAddress}
          onChangeText={setTaxAddress}
        />
        <Button title="Save Tax Info" onPress={saveTaxProfile} />
        <Text style={styles.helperNote}>1099 documents use this profile at year-end payout processing.</Text>
      </View>

      <View style={styles.queueCard}>
        <Text style={styles.queueTitle}>Vehicle Inspection Upload</Text>
        <TextInput
          style={styles.input}
          placeholder="Inspection center (optional)"
          value={inspectionCenter}
          onChangeText={setInspectionCenter}
        />
        <TextInput
          style={styles.input}
          placeholder="Inspection notes (optional)"
          value={inspectionNotes}
          onChangeText={setInspectionNotes}
        />
        {inspectionLoading ? <ActivityIndicator /> : <Button title="Upload Vehicle Inspection" onPress={uploadVehicleInspection} />}
      </View>

      <View style={styles.spacer} />
      <Button title="Next: Vehicle Info" onPress={() => navigation.navigate('VehicleInfo')} />
    </ScrollView>
  );
}

type VehicleInfoProps = NativeStackScreenProps<RootStackParamList, 'VehicleInfo'> & {
  context: OnboardingContext;
};

function VehicleInfoScreen({ navigation, context }: VehicleInfoProps) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [color, setColor] = useState('');
  const [powertrain, setPowertrain] = useState('gasoline');
  const [rideCategory, setRideCategory] = useState('rydine_regular');
  const [loading, setLoading] = useState(false);

  const saveVehicle = useCallback(async () => {
    if (!context.driverId) {
      Alert.alert('Missing Driver', 'Please complete registration first.');
      return;
    }

    if (!make || !model || !year || !plateNumber) {
      Alert.alert('Validation', 'Please fill make, model, year, and plate number.');
      return;
    }

    const yearNumber = Number(year);
    const currentYear = new Date().getUTCFullYear();
    if (!Number.isInteger(yearNumber) || yearNumber < 2013 || yearNumber > currentYear + 1) {
      Alert.alert('Validation', `Vehicle year must be between 2013 and ${currentYear + 1}.`);
      return;
    }

    const normalizedPowertrain = powertrain.trim().toLowerCase();
    if (!['gasoline', 'diesel', 'hybrid', 'electric'].includes(normalizedPowertrain)) {
      Alert.alert('Validation', 'Powertrain must be gasoline, diesel, hybrid, or electric.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/vehicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          make,
          model,
          year: yearNumber,
          plateNumber,
          color,
          powertrain: normalizedPowertrain,
          rideCategory,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Vehicle info save failed.');
      }

      navigation.navigate('PendingApproval');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to save vehicle info.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [color, context.driverId, make, model, navigation, plateNumber, powertrain, rideCategory, year]);

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      <TextInput style={styles.input} placeholder="Vehicle make" value={make} onChangeText={setMake} />
      <TextInput style={styles.input} placeholder="Vehicle model" value={model} onChangeText={setModel} />
      <TextInput style={styles.input} placeholder="Year" value={year} onChangeText={setYear} keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="Plate number" value={plateNumber} onChangeText={setPlateNumber} autoCapitalize="characters" />
      <TextInput style={styles.input} placeholder="Color" value={color} onChangeText={setColor} />
      <TextInput
        style={styles.input}
        placeholder="Powertrain (gasoline, diesel, hybrid, electric)"
        value={powertrain}
        onChangeText={setPowertrain}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Ride category (rydine_regular, rydine_comfort, rydine_xl, rydine_green, black_car, black_suv)"
        value={rideCategory}
        onChangeText={setRideCategory}
        autoCapitalize="none"
      />
      {loading ? <ActivityIndicator /> : <Button title="Submit Vehicle Info" onPress={saveVehicle} />}
    </ScrollView>
  );
}

type PendingApprovalProps = NativeStackScreenProps<RootStackParamList, 'PendingApproval'> & {
  context: OnboardingContext;
};

function PendingApprovalScreen({ navigation, context }: PendingApprovalProps) {
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('Waiting for admin review.');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastLocation, setLastLocation] = useState<DriverCoordinates | null>(null);
  const [lastAccuracyMeters, setLastAccuracyMeters] = useState<number | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [trackingError, setTrackingError] = useState('');
  const [queueStatus, setQueueStatus] = useState<DriverAirportQueueStatus | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueActionLoading, setQueueActionLoading] = useState(false);
  const [queueActionMessage, setQueueActionMessage] = useState('');
  const [queueActionCooldownUntil, setQueueActionCooldownUntil] = useState(0);
  const [queueActionNow, setQueueActionNow] = useState(Date.now());
  const [selectedQueueRideCategory, setSelectedQueueRideCategory] = useState<'black_car' | 'suv'>('black_car');
  const [surgeVisibility, setSurgeVisibility] = useState<DriverSurgeVisibility | null>(null);
  const [selectedSurgeCategory, setSelectedSurgeCategory] = useState<'black_car' | 'suv'>('black_car');
  const [surgeLoading, setSurgeLoading] = useState(false);
  const [surgeError, setSurgeError] = useState('');
  const [multiStateRules, setMultiStateRules] = useState<MultiStateRulesProfile | null>(null);
  const [multiStateLoading, setMultiStateLoading] = useState(false);
  const [multiStateSaving, setMultiStateSaving] = useState(false);
  const [operatingStatesInput, setOperatingStatesInput] = useState('IL');
  const [chauffeurLicenseNumber, setChauffeurLicenseNumber] = useState('');
  const [chauffeurIssuingState, setChauffeurIssuingState] = useState('IL');
  const [chauffeurExpiresAt, setChauffeurExpiresAt] = useState('');
  const [chauffeurLoading, setChauffeurLoading] = useState(false);
  const [chauffeurStatus, setChauffeurStatus] = useState<ChauffeurLicenseProfile | null>(null);
  const [tripPreferences, setTripPreferences] = useState<DriverTripPreferences>({
    serviceDogEnabled: true,
    teenPickupEnabled: false,
  });
  const [tripPreferencesSaving, setTripPreferencesSaving] = useState(false);
  const [proStatus, setProStatus] = useState<DriverProStatusResponse | null>(null);
  const [proStatusLoading, setProStatusLoading] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartedAt, setBreakStartedAt] = useState<number | null>(null);
  const [drivingAccumulatedMs, setDrivingAccumulatedMs] = useState(0);
  const [shiftTicker, setShiftTicker] = useState(Date.now());
  const [destinationKeyInput, setDestinationKeyInput] = useState('');
  const [destinationUsageDateKey, setDestinationUsageDateKey] = useState(toDateKey());
  const [destinationUsage, setDestinationUsage] = useState<DestinationKeyUsage[]>([]);
  const [roadClosureNote, setRoadClosureNote] = useState('');
  const [roadClosureLoading, setRoadClosureLoading] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestCoordinatesRef = useRef<DriverCoordinates | null>(null);
  const lastEmittedLocationRef = useRef<DriverCoordinates | null>(null);
  const lastQueueRefreshAtRef = useRef<number>(0);
  const lastSurgeRefreshAtRef = useRef<number>(0);
  const drivingSessionStartedAtRef = useRef<number | null>(null);
  const shiftLimitAlertedRef = useRef(false);
  const lastQueueActionAtRef = useRef(0);

  const gpsQuality = useMemo(() => deriveGpsQuality(lastAccuracyMeters), [lastAccuracyMeters]);
  const proTierChipStyle = useMemo(() => getProTierChipStyle(proStatus?.currentTier?.code), [proStatus?.currentTier?.code]);
  const totalDrivingMs = useMemo(() => {
    const activeDrivingMs =
      isOnline && drivingSessionStartedAtRef.current ? Math.max(shiftTicker - drivingSessionStartedAtRef.current, 0) : 0;
    return drivingAccumulatedMs + activeDrivingMs;
  }, [drivingAccumulatedMs, isOnline, shiftTicker]);
  const drivingHoursUsed = useMemo(() => Number((totalDrivingMs / (60 * 60 * 1000)).toFixed(2)), [totalDrivingMs]);
  const drivingHoursRemaining = useMemo(
    () => Number(Math.max((MAX_SHIFT_DRIVING_MS - totalDrivingMs) / (60 * 60 * 1000), 0).toFixed(2)),
    [totalDrivingMs]
  );
  const destinationKeysRemaining = useMemo(
    () => Math.max(DESTINATION_KEY_DAILY_LIMIT - destinationUsage.length, 0),
    [destinationUsage.length]
  );
  const isBusyEarningsWindow = useMemo(
    () => Number(surgeVisibility?.surgeMultiplier || 1) >= 1.25 || surgeVisibility?.trend === 'rising',
    [surgeVisibility?.surgeMultiplier, surgeVisibility?.trend]
  );
  const queueActionCooldownSeconds = useMemo(() => {
    if (!queueActionCooldownUntil) {
      return 0;
    }

    return Math.max(0, Math.ceil((queueActionCooldownUntil - queueActionNow) / 1000));
  }, [queueActionCooldownUntil, queueActionNow]);
  const isQueueActionCoolingDown = queueActionCooldownSeconds > 0;

  useEffect(() => {
    if (!queueActionCooldownUntil || queueActionCooldownUntil <= Date.now()) {
      setQueueActionNow(Date.now());
      return;
    }

    const timerId = setInterval(() => {
      setQueueActionNow(Date.now());
    }, 250);

    return () => {
      clearInterval(timerId);
    };
  }, [queueActionCooldownUntil]);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permissionResult = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location Permission',
      message: 'Rydinex Driver needs location access to send driver heartbeat updates.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    return permissionResult === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const ensureSocketConnection = useCallback(() => {
    if (socketRef.current) {
      return socketRef.current;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      setTrackingError('');
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('connect_error', connectionError => {
      setTrackingError(connectionError.message || 'Unable to connect to realtime server.');
    });

    socketRef.current = socket;
    return socket;
  }, []);

  const emitDriverLocation = useCallback(
    (
      eventName: 'driver:online' | 'driver:heartbeat',
      coordinates: DriverCoordinates,
      options: { force?: boolean } = {}
    ) => {
      if (!context.driverId) {
        return;
      }

      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      if (!options.force) {
        const shouldEmit = shouldEmitLocationUpdate(lastEmittedLocationRef.current, coordinates);
        if (!shouldEmit) {
          return;
        }
      }

      socket.emit(
        eventName,
        {
          driverId: context.driverId,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          accuracyMeters: coordinates.accuracyMeters ?? undefined,
        },
        (acknowledgement: { ok?: boolean; message?: string } | undefined) => {
          if (acknowledgement && acknowledgement.ok === false) {
            setTrackingError(acknowledgement.message || 'Location update failed.');
            return;
          }

          lastEmittedLocationRef.current = coordinates;
          setLastHeartbeatAt(Date.now());
          setTrackingError('');
        }
      );
    },
    [context.driverId]
  );

  const refreshAirportQueueStatus = useCallback(
    async (coordinates: DriverCoordinates | null = latestCoordinatesRef.current) => {
      if (!context.driverId) {
        return;
      }

      try {
        setQueueLoading(true);

        const queryParams = [
          `rideCategory=${encodeURIComponent(selectedQueueRideCategory)}`,
        ];

        if (coordinates) {
          queryParams.push(`latitude=${encodeURIComponent(String(coordinates.latitude))}`);
          queryParams.push(`longitude=${encodeURIComponent(String(coordinates.longitude))}`);
        }

        const query = queryParams.length ? `?${queryParams.join('&')}` : '';

        const response = await fetch(`${API_BASE_URL}/airport-queue/driver/${context.driverId}/status${query}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || 'Failed to fetch operations queue status.');
        }

        setQueueStatus(payload);
      } catch (queueError: unknown) {
        const message = queueError instanceof Error ? queueError.message : 'Unable to fetch operations queue status.';
        setTrackingError(message);
      } finally {
        setQueueLoading(false);
      }
    },
    [context.driverId, selectedQueueRideCategory]
  );

  const refreshSurgeVisibility = useCallback(
    async (coordinates: DriverCoordinates | null = latestCoordinatesRef.current) => {
      if (!context.driverId || !coordinates) {
        return;
      }

      try {
        setSurgeLoading(true);
        setSurgeError('');

        const response = await fetch(
          `${API_BASE_URL}/drivers/${context.driverId}/surge-visibility?latitude=${encodeURIComponent(
            String(coordinates.latitude)
          )}&longitude=${encodeURIComponent(String(coordinates.longitude))}&rideCategory=${encodeURIComponent(selectedSurgeCategory)}`
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || 'Failed to fetch surge visibility.');
        }

        setSurgeVisibility(payload);
      } catch (surgeVisibilityError: unknown) {
        const message = surgeVisibilityError instanceof Error ? surgeVisibilityError.message : 'Unable to fetch surge visibility.';
        setSurgeError(message);
      } finally {
        setSurgeLoading(false);
      }
    },
    [context.driverId, selectedSurgeCategory]
  );

  const refreshAirportQueueStatusThrottled = useCallback(
    (coordinates: DriverCoordinates | null = latestCoordinatesRef.current, force = false) => {
      const now = Date.now();
      const elapsedMs = now - lastQueueRefreshAtRef.current;

      if (!force && elapsedMs < MIN_QUEUE_REFRESH_INTERVAL_MS) {
        return;
      }

      lastQueueRefreshAtRef.current = now;
      refreshAirportQueueStatus(coordinates).catch(() => null);
    },
    [refreshAirportQueueStatus]
  );

  const postQueueActionWithRetry = useCallback(
    async (path: '/airport-queue/enter' | '/airport-queue/exit', body: Record<string, unknown>) => {
      let lastErrorMessage = 'Queue request failed.';

      for (let attempt = 0; attempt <= QUEUE_ACTION_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          const payload = await response.json().catch(() => ({}));
          if (response.ok) {
            return payload;
          }

          lastErrorMessage = payload?.message || `Queue request failed with status ${response.status}.`;

          const canRetry = response.status >= 500 || response.status === 429;
          if (!canRetry || attempt === QUEUE_ACTION_RETRY_DELAYS_MS.length) {
            throw new Error(lastErrorMessage);
          }
        } catch (queueNetworkError: unknown) {
          if (queueNetworkError instanceof Error) {
            lastErrorMessage = queueNetworkError.message || lastErrorMessage;
          }

          if (attempt === QUEUE_ACTION_RETRY_DELAYS_MS.length) {
            throw new Error(lastErrorMessage);
          }
        }

        await waitFor(QUEUE_ACTION_RETRY_DELAYS_MS[attempt]);
      }

      throw new Error(lastErrorMessage);
    },
    []
  );

  const refreshSurgeVisibilityThrottled = useCallback(
    (coordinates: DriverCoordinates | null = latestCoordinatesRef.current, force = false) => {
      const now = Date.now();
      const elapsedMs = now - lastSurgeRefreshAtRef.current;

      if (!force && elapsedMs < 15000) {
        return;
      }

      lastSurgeRefreshAtRef.current = now;
      refreshSurgeVisibility(coordinates).catch(() => null);
    },
    [refreshSurgeVisibility]
  );

  const refreshProStatus = useCallback(async () => {
    if (!context.driverId) {
      return;
    }

    try {
      setProStatusLoading(true);
      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/pro-status`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load RydineX Pro status.');
      }

      setProStatus(payload);
    } catch (proStatusError: unknown) {
      const message = proStatusError instanceof Error ? proStatusError.message : 'Unable to load RydineX Pro status.';
      setTrackingError(message);
    } finally {
      setProStatusLoading(false);
    }
  }, [context.driverId]);

  const openMapSearch = useCallback(async (query: string) => {
    const coordinates = latestCoordinatesRef.current;
    const nearSuffix = coordinates ? ` near ${coordinates.latitude.toFixed(4)},${coordinates.longitude.toFixed(4)}` : '';
    const searchQuery = `${query}${nearSuffix}`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
    const appUrl =
      Platform.OS === 'android'
        ? `geo:0,0?q=${encodedQuery}`
        : Platform.OS === 'ios'
          ? `comgooglemaps://?q=${encodedQuery}`
          : null;

    try {
      if (appUrl) {
        const canOpenGoogleMaps = await Linking.canOpenURL(appUrl);
        if (canOpenGoogleMaps) {
          await Linking.openURL(appUrl);
          return;
        }
      }

      await Linking.openURL(webUrl);
    } catch {
      Alert.alert('Maps', 'Unable to open Google Maps right now.');
    }
  }, []);

  const openEmergencySupport = useCallback(() => {
    Alert.alert('Emergency', 'Call emergency services now?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Call 911',
        style: 'destructive',
        onPress: () => {
          Linking.openURL('tel:911').catch(() => {
            Alert.alert('Emergency', 'Unable to open phone dialer on this device.');
          });
        },
      },
    ]);
  }, []);

  const reportRoadClosure = useCallback(async () => {
    if (!context.driverId) {
      Alert.alert('Missing Driver', 'Driver information is required.');
      return;
    }

    const note = roadClosureNote.trim();
    if (!note) {
      Alert.alert('Road Closure', 'Add a short closure note before reporting.');
      return;
    }

    try {
      setRoadClosureLoading(true);

      const coordinates = latestCoordinatesRef.current || lastLocation;
      const response = await fetch(`${API_BASE_URL}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'road_closure',
          subject: 'Driver reported road closure',
          description: note,
          driverId: context.driverId,
          submittedByType: 'driver',
          submittedById: context.driverId,
          priority: 'high',
          metadata: {
            latitude: coordinates?.latitude,
            longitude: coordinates?.longitude,
            detectedAirport: queueStatus?.detectedAirport?.code || null,
            reportedAt: new Date().toISOString(),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to report road closure.');
      }

      setRoadClosureNote('');
      Alert.alert('Reported', 'Road closure sent to operations feed for nearby drivers.');
    } catch (roadClosureError: unknown) {
      const message = roadClosureError instanceof Error ? roadClosureError.message : 'Unable to report road closure.';
      Alert.alert('Road Closure', message);
    } finally {
      setRoadClosureLoading(false);
    }
  }, [context.driverId, lastLocation, queueStatus?.detectedAirport?.code, roadClosureNote]);

  const activateDestinationKey = useCallback(async () => {
    const destination = destinationKeyInput.trim();
    if (!destination) {
      Alert.alert('Destination Key', 'Enter a destination first.');
      return;
    }

    const todayKey = toDateKey();
    if (todayKey !== destinationUsageDateKey) {
      setDestinationUsageDateKey(todayKey);
      setDestinationUsage([]);
    }

    if (destinationKeysRemaining <= 0 && todayKey === destinationUsageDateKey) {
      Alert.alert('Destination Key', `Daily limit reached (${DESTINATION_KEY_DAILY_LIMIT}/day).`);
      return;
    }

    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    await Linking.openURL(navigationUrl);

    setDestinationUsage(previous => {
      const refreshed = todayKey === destinationUsageDateKey ? previous : [];
      return [...refreshed, { destination, usedAt: Date.now() }];
    });
    setDestinationKeyInput('');
  }, [destinationKeyInput, destinationKeysRemaining, destinationUsageDateKey]);

  const loadMultiStateRules = useCallback(async () => {
    if (!context.driverId) {
      return;
    }

    try {
      setMultiStateLoading(true);
      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/multi-state-rules`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to fetch multi-state rules.');
      }

      setMultiStateRules(payload);
      if (Array.isArray(payload.operatingStates) && payload.operatingStates.length) {
        setOperatingStatesInput(payload.operatingStates.join(', '));
      }
    } catch (multiStateError: unknown) {
      const message = multiStateError instanceof Error ? multiStateError.message : 'Unable to fetch multi-state rules.';
      setTrackingError(message);
    } finally {
      setMultiStateLoading(false);
    }
  }, [context.driverId]);

  const saveMultiStateRules = useCallback(async () => {
    if (!context.driverId) {
      Alert.alert('Missing Driver', 'Driver information is required.');
      return;
    }

    const operatingStates = operatingStatesInput
      .split(',')
      .map(item => item.trim().toUpperCase())
      .filter(Boolean);

    if (!operatingStates.length) {
      Alert.alert('Validation', 'Enter at least one state code, for example IL, IN.');
      return;
    }

    try {
      setMultiStateSaving(true);
      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/multi-state-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatingStates }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to save multi-state rules.');
      }

      setMultiStateRules(payload.profile || null);
      Alert.alert('Saved', 'Operating state rules updated.');
    } catch (multiStateSaveError: unknown) {
      const message = multiStateSaveError instanceof Error ? multiStateSaveError.message : 'Unable to save multi-state rules.';
      Alert.alert('Error', message);
    } finally {
      setMultiStateSaving(false);
    }
  }, [context.driverId, operatingStatesInput]);

  const verifyChauffeurLicense = useCallback(async () => {
    if (!context.driverId) {
      Alert.alert('Missing Driver', 'Driver information is required.');
      return;
    }

    if (!chauffeurLicenseNumber.trim() || !chauffeurIssuingState.trim()) {
      Alert.alert('Validation', 'License number and issuing state are required.');
      return;
    }

    try {
      setChauffeurLoading(true);
      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/chauffeur-license/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseNumber: chauffeurLicenseNumber.trim().toUpperCase(),
          issuingState: chauffeurIssuingState.trim().toUpperCase(),
          expiresAt: chauffeurExpiresAt.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Chauffeur license verification failed.');
      }

      setChauffeurStatus(payload.chauffeurLicense || null);
      Alert.alert('Verification Updated', payload?.chauffeurLicense?.status || 'updated');
    } catch (chauffeurVerificationError: unknown) {
      const message =
        chauffeurVerificationError instanceof Error
          ? chauffeurVerificationError.message
          : 'Unable to verify chauffeur license.';
      Alert.alert('Error', message);
    } finally {
      setChauffeurLoading(false);
    }
  }, [context.driverId, chauffeurExpiresAt, chauffeurIssuingState, chauffeurLicenseNumber]);

  const enterAirportQueue = useCallback(async () => {
    if (!context.driverId) {
      Alert.alert('Missing Driver', 'Driver information is required.');
      return;
    }

    const coordinates = latestCoordinatesRef.current;
    if (!coordinates) {
      Alert.alert('Location Required', 'Current location is required to join operations queue.');
      return;
    }

    const now = Date.now();
    if (queueActionLoading || now - lastQueueActionAtRef.current < QUEUE_ACTION_DEBOUNCE_MS || isQueueActionCoolingDown) {
      setQueueActionMessage(`Please wait ${Math.max(queueActionCooldownSeconds, 1)}s before sending another queue action.`);
      return;
    }

    try {
      lastQueueActionAtRef.current = now;
      setQueueActionCooldownUntil(now + QUEUE_ACTION_DEBOUNCE_MS);
      setQueueActionLoading(true);
      setQueueActionMessage('Submitting queue entry...');

      const resolvedQueueType = queueStatus?.isInEventVenue ? 'event' : queueStatus?.isInAirportLot ? 'airport' : undefined;
      const resolvedAirportCode = resolvedQueueType === 'airport' ? queueStatus?.detectedAirport?.code : undefined;
      const resolvedEventCode = resolvedQueueType === 'event' ? queueStatus?.detectedEvent?.code : undefined;

      await postQueueActionWithRetry('/airport-queue/enter', {
        driverId: context.driverId,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        queueType: resolvedQueueType,
        airportCode: resolvedAirportCode,
        eventCode: resolvedEventCode,
        rideCategory: selectedQueueRideCategory,
      });

      refreshAirportQueueStatusThrottled(coordinates, true);
      setQueueActionMessage('Queue entry updated successfully.');
    } catch (queueError: unknown) {
      const message = queueError instanceof Error ? queueError.message : 'Unable to enter operations queue.';
      setQueueActionMessage(message);
      Alert.alert('Queue Error', message);
    } finally {
      setQueueActionLoading(false);
    }
  }, [
    context.driverId,
    queueStatus?.detectedAirport?.code,
    queueStatus?.detectedEvent?.code,
    queueStatus?.isInAirportLot,
    queueStatus?.isInEventVenue,
    isQueueActionCoolingDown,
    queueActionCooldownSeconds,
    queueActionLoading,
    refreshAirportQueueStatusThrottled,
    selectedQueueRideCategory,
    postQueueActionWithRetry,
  ]);

  const exitAirportQueue = useCallback(
    async (reason = 'Driver exited operations queue from app.') => {
      if (!context.driverId) {
        return;
      }

      const now = Date.now();
      if (queueActionLoading || now - lastQueueActionAtRef.current < QUEUE_ACTION_DEBOUNCE_MS || isQueueActionCoolingDown) {
        setQueueActionMessage(`Please wait ${Math.max(queueActionCooldownSeconds, 1)}s before sending another queue action.`);
        return;
      }

      try {
        lastQueueActionAtRef.current = now;
        setQueueActionCooldownUntil(now + QUEUE_ACTION_DEBOUNCE_MS);
        setQueueActionLoading(true);
        setQueueActionMessage('Submitting queue exit...');

        const activeQueueEntry = queueStatus?.queueEntry;

        await postQueueActionWithRetry('/airport-queue/exit', {
          driverId: context.driverId,
          queueType: activeQueueEntry?.queueType,
          airportCode: activeQueueEntry?.airportCode || undefined,
          eventCode: activeQueueEntry?.eventCode || undefined,
          reason,
        });

        refreshAirportQueueStatusThrottled(latestCoordinatesRef.current, true);
        setQueueActionMessage('Queue exit updated successfully.');
      } catch (queueError: unknown) {
        const message = queueError instanceof Error ? queueError.message : 'Unable to exit operations queue.';
        setQueueActionMessage(message);
        Alert.alert('Queue Error', message);
      } finally {
        setQueueActionLoading(false);
      }
    },
    [
      context.driverId,
      isQueueActionCoolingDown,
      queueActionCooldownSeconds,
      queueActionLoading,
      queueStatus?.queueEntry,
      refreshAirportQueueStatusThrottled,
      postQueueActionWithRetry,
    ]
  );

  const formatEstimatedWait = useCallback((minutes: number | null | undefined) => {
    if (!Number.isFinite(Number(minutes))) {
      return 'N/A';
    }

    return `${Number(minutes).toFixed(0)} min`;
  }, []);

  const stopTracking = useCallback((reason = 'Driver went offline.') => {
    const now = Date.now();

    if (drivingSessionStartedAtRef.current) {
      const elapsedMs = Math.max(now - drivingSessionStartedAtRef.current, 0);
      if (elapsedMs > 0) {
        setDrivingAccumulatedMs(previous => previous + elapsedMs);
      }
      drivingSessionStartedAtRef.current = null;
    }

    setIsOnline(false);
    setShiftTicker(now);

    if (context.driverId && queueStatus?.queueEntry?.status === 'waiting') {
      const activeQueueEntry = queueStatus.queueEntry;

      fetch(`${API_BASE_URL}/airport-queue/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: context.driverId,
          queueType: activeQueueEntry.queueType,
          airportCode: activeQueueEntry.airportCode || undefined,
          eventCode: activeQueueEntry.eventCode || undefined,
          reason,
        }),
      }).catch(() => null);
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.emit('driver:offline', {
        driverId: context.driverId,
      });
      socketRef.current.disconnect();
      socketRef.current.removeAllListeners();
      socketRef.current = null;
    }

    lastEmittedLocationRef.current = null;
    lastQueueRefreshAtRef.current = 0;
    lastSurgeRefreshAtRef.current = 0;

    setSocketConnected(false);
    setQueueStatus(null);
  }, [context.driverId, queueStatus]);

  const startBreakMode = useCallback(() => {
    if (isOnline) {
      stopTracking('Driver started a break.');
    }

    setIsOnBreak(true);
    setBreakStartedAt(Date.now());
    openMapSearch('restroom restaurant gas station near me').catch(() => null);
  }, [isOnline, openMapSearch, stopTracking]);

  const endBreakMode = useCallback(() => {
    setIsOnBreak(false);
    setBreakStartedAt(null);
  }, []);

  const startTracking = useCallback(async () => {
    if (!context.driverId) {
      Alert.alert('Missing Driver', 'Please complete registration first.');
      return;
    }

    if (status !== 'approved') {
      Alert.alert('Not Approved', 'You can only go online after admin approval.');
      return;
    }

    if (totalDrivingMs >= MAX_SHIFT_DRIVING_MS) {
      Alert.alert('Driving Limit Reached', `You have reached the ${MAX_SHIFT_DRIVING_HOURS}-hour drive limit. Please rest before going online again.`);
      return;
    }

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Location Permission', 'Enable location access to start live tracking.');
      return;
    }

    setTrackingError('');
    ensureSocketConnection();

    Geolocation.getCurrentPosition(
      position => {
        const accuracyMeters = Number.isFinite(Number(position.coords.accuracy)) ? Number(position.coords.accuracy) : null;
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters,
          recordedAt: Date.now(),
        };

        setLastAccuracyMeters(accuracyMeters);

        latestCoordinatesRef.current = coordinates;
        setLastLocation(coordinates);

        if (accuracyMeters !== null && accuracyMeters > MAX_RELIABLE_GPS_ACCURACY_METERS) {
          setTrackingError('GPS signal is weak. Move to an open area for better tracking.');
        }

        emitDriverLocation('driver:online', coordinates, { force: true });
        refreshAirportQueueStatusThrottled(coordinates, true);
        refreshSurgeVisibilityThrottled(coordinates, true);
      },
      locationError => {
        setTrackingError(locationError.message || 'Unable to fetch current location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      }
    );

    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = Geolocation.watchPosition(
      position => {
        const accuracyMeters = Number.isFinite(Number(position.coords.accuracy)) ? Number(position.coords.accuracy) : null;
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters,
          recordedAt: Date.now(),
        };

        setLastAccuracyMeters(accuracyMeters);

        if (accuracyMeters !== null && accuracyMeters > MAX_RELIABLE_GPS_ACCURACY_METERS) {
          setTrackingError('GPS accuracy is low. Waiting for a cleaner location sample.');
          return;
        }

        latestCoordinatesRef.current = coordinates;
        setLastLocation(coordinates);
        emitDriverLocation('driver:heartbeat', coordinates);
        refreshAirportQueueStatusThrottled(coordinates);
        refreshSurgeVisibilityThrottled(coordinates);
      },
      locationError => {
        setTrackingError(locationError.message || 'Location tracking error.');
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 4000,
        fastestInterval: 3000,
      }
    );

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (latestCoordinatesRef.current) {
        emitDriverLocation('driver:heartbeat', latestCoordinatesRef.current);
        refreshAirportQueueStatusThrottled(latestCoordinatesRef.current);
        refreshSurgeVisibilityThrottled(latestCoordinatesRef.current);
      }
    }, 4000);

    if (!drivingSessionStartedAtRef.current) {
      drivingSessionStartedAtRef.current = Date.now();
    }

    setIsOnBreak(false);
    setBreakStartedAt(null);
    setIsOnline(true);
  }, [
    context.driverId,
    emitDriverLocation,
    ensureSocketConnection,
    refreshAirportQueueStatusThrottled,
    refreshSurgeVisibilityThrottled,
    requestLocationPermission,
    status,
    totalDrivingMs,
  ]);

  const refreshStatus = useCallback(async () => {
    if (!context.driverId) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/status`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to get status.');
      }

      setStatus(payload.status || 'pending');
      setChauffeurStatus(payload.chauffeurLicense || null);
      setTripPreferences({
        serviceDogEnabled: payload?.tripPreferences?.serviceDogEnabled !== false,
        teenPickupEnabled: Boolean(payload?.tripPreferences?.teenPickupEnabled),
      });
      if (Array.isArray(payload.operatingStates) && payload.operatingStates.length) {
        setOperatingStatesInput(payload.operatingStates.join(', '));
      }

      if (payload.status === 'rejected') {
        setMessage(payload.rejectionReason || 'Rejected by admin.');
      } else if (payload.status === 'approved') {
        setMessage('Approved. You can start accepting rides.');
      } else {
        setMessage('Waiting for admin review.');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to refresh approval status.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [context.driverId]);

  const toggleOnlineStatus = useCallback(
    (value: boolean) => {
      if (value) {
        if (isOnBreak) {
          endBreakMode();
        }

        startTracking();
        return;
      }

      stopTracking();
    },
    [endBreakMode, isOnBreak, startTracking, stopTracking]
  );

  const saveTripPreferences = useCallback(
    async (nextPreferences: DriverTripPreferences) => {
      if (!context.driverId) {
        return;
      }

      try {
        setTripPreferencesSaving(true);

        const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/trip-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextPreferences),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Failed to save trip preferences.');
        }

        setTripPreferences({
          serviceDogEnabled: payload?.tripPreferences?.serviceDogEnabled !== false,
          teenPickupEnabled: Boolean(payload?.tripPreferences?.teenPickupEnabled),
        });
      } catch (preferenceError: unknown) {
        const message = preferenceError instanceof Error ? preferenceError.message : 'Unable to save trip preferences.';
        Alert.alert('Preferences', message);
      } finally {
        setTripPreferencesSaving(false);
      }
    },
    [context.driverId]
  );

  const toggleServiceDogPreference = useCallback(
    (enabled: boolean) => {
      const nextPreferences = {
        ...tripPreferences,
        serviceDogEnabled: enabled,
      };
      setTripPreferences(nextPreferences);
      saveTripPreferences(nextPreferences);
    },
    [saveTripPreferences, tripPreferences]
  );

  const toggleTeenPickupPreference = useCallback(
    (enabled: boolean) => {
      const nextPreferences = {
        ...tripPreferences,
        teenPickupEnabled: enabled,
      };
      setTripPreferences(nextPreferences);
      saveTripPreferences(nextPreferences);
    },
    [saveTripPreferences, tripPreferences]
  );

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!context.driverId) {
      return;
    }

    refreshAirportQueueStatusThrottled(latestCoordinatesRef.current, true);
    refreshSurgeVisibilityThrottled(latestCoordinatesRef.current, true);
    loadMultiStateRules();
    refreshProStatus();
  }, [context.driverId, loadMultiStateRules, refreshAirportQueueStatusThrottled, refreshProStatus, refreshSurgeVisibilityThrottled]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setShiftTicker(Date.now());
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const todayKey = toDateKey();
      if (todayKey !== destinationUsageDateKey) {
        setDestinationUsageDateKey(todayKey);
        setDestinationUsage([]);
        setDrivingAccumulatedMs(0);
        drivingSessionStartedAtRef.current = isOnline ? Date.now() : null;
        shiftLimitAlertedRef.current = false;
      }
    }, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [destinationUsageDateKey, isOnline]);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    if (totalDrivingMs < MAX_SHIFT_DRIVING_MS || shiftLimitAlertedRef.current) {
      return;
    }

    shiftLimitAlertedRef.current = true;
    stopTracking('Reached 12-hour drive limit.');
    Alert.alert('Drive Limit Reached', `You are now offline. Daily driving is capped at ${MAX_SHIFT_DRIVING_HOURS} hours.`);
  }, [isOnline, stopTracking, totalDrivingMs]);

  useEffect(() => {
    if (status !== 'approved' && isOnline) {
      stopTracking();
    }
  }, [isOnline, status, stopTracking]);

  useEffect(
    () => () => {
      stopTracking();
    },
    [stopTracking]
  );

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      <Text style={styles.statusTitle}>Current Status: {status.toUpperCase()}</Text>
      <Text style={styles.statusMessage}>{message}</Text>
      {loading ? <ActivityIndicator /> : <Button title="Refresh Status" onPress={refreshStatus} />}
      {status === 'approved' ? <Button title="Open Incoming Requests" onPress={() => navigation.navigate('IncomingRequests')} /> : null}

      <View style={styles.trackingCard}>
        <View style={styles.trackingHeaderRow}>
          <Text style={styles.trackingTitle}>Realtime Driver Tracking</Text>
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
            <Switch value={isOnline} onValueChange={toggleOnlineStatus} disabled={status !== 'approved'} />
          </View>
        </View>

        <Text style={styles.trackingText}>Socket: {socketConnected ? 'Connected' : 'Disconnected'}</Text>
        <Text style={styles.trackingText}>Heartbeat interval: every 4 seconds</Text>
        <Text style={styles.trackingText}>
          Last coordinates:{' '}
          {lastLocation ? `${lastLocation.latitude.toFixed(5)}, ${lastLocation.longitude.toFixed(5)}` : 'Not available yet'}
        </Text>
        <Text style={styles.trackingText}>
          GPS accuracy: {lastAccuracyMeters !== null ? `+/-${Number(lastAccuracyMeters).toFixed(0)} m` : 'Not available yet'}
        </Text>
        <Text style={[styles.trackingText, gpsQuality === 'Poor' ? styles.gpsQualityPoor : styles.gpsQualityGood]}>
          GPS quality: {gpsQuality}
        </Text>
        <Text style={styles.trackingText}>
          Last heartbeat: {lastHeartbeatAt ? new Date(lastHeartbeatAt).toLocaleTimeString() : 'No heartbeat sent yet'}
        </Text>

        <View style={styles.queueCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.queueTitle}>RydineX Pro</Text>
            <Text style={[styles.statusChip, { backgroundColor: proTierChipStyle.backgroundColor, color: proTierChipStyle.color }]}>
              {proStatus?.currentTier?.label?.toUpperCase() || 'BLUE'}
            </Text>
          </View>
          {proStatusLoading ? <ActivityIndicator size="small" /> : null}
          <Text style={styles.queueText}>Trips ({proStatus?.lookbackDays || 90}d): {proStatus?.completedTrips ?? 0}</Text>
          <Text style={styles.queueText}>
            Rider rating: {Number.isFinite(Number(proStatus?.averageRiderRating)) ? Number(proStatus?.averageRiderRating).toFixed(2) : 'N/A'}
          </Text>
          <Text style={styles.queueText}>Progress to next tier: {Number(proStatus?.tripProgressPercent || 0).toFixed(1)}%</Text>
          <Text style={styles.queueText}>
            Next tier target: {proStatus?.nextTier ? `${proStatus.nextTier.label} (${proStatus.tripsToNextTier} trips left)` : 'Top tier unlocked'}
          </Text>
          {(proStatus?.perks || []).map(perk => (
            <Text key={`perk-${perk}`} style={styles.tripSubtleText}>Perk: {perk}</Text>
          ))}
          {(proStatus?.rewards || []).map(reward => (
            <Text key={`reward-${reward}`} style={styles.tripSubtleText}>Reward: {reward}</Text>
          ))}
          <View style={styles.queueActionsRow}>
            <View style={styles.tripActionButton}>
              <Button title="Refresh Pro" onPress={refreshProStatus} />
            </View>
          </View>
        </View>

        <View style={styles.queueCard}>
          <Text style={styles.queueTitle}>Drive Time, Break, and Safety</Text>
          <Text style={styles.queueText}>Driving used today: {drivingHoursUsed.toFixed(2)}h</Text>
          <Text style={styles.queueText}>Driving remaining today: {drivingHoursRemaining.toFixed(2)}h</Text>
          <Text style={styles.queueText}>Break mode: {isOnBreak ? 'ON BREAK' : 'ACTIVE'}</Text>
          {breakStartedAt ? <Text style={styles.queueText}>Break started: {new Date(breakStartedAt).toLocaleTimeString()}</Text> : null}
          {isOnline ? (
            <>
              <Text style={styles.helperNote}>Break map shortcuts (Google Maps)</Text>
              <View style={styles.mapQuickActionsRail}>
                <View style={styles.mapQuickActionButton}>
                  <Button title={isOnBreak ? 'End Break' : 'Start Break'} onPress={isOnBreak ? endBreakMode : startBreakMode} />
                </View>
                {BREAK_SPOT_QUICK_ACTIONS.map(action => (
                  <View key={action.id} style={styles.mapQuickActionButton}>
                    <Button title={action.label} onPress={() => openMapSearch(action.query)} />
                  </View>
                ))}
                <View style={styles.mapQuickActionButton}>
                  <Button title="Emergency" onPress={openEmergencySupport} color="#dc2626" />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.helperNote}>Go online to show right-side map shortcuts.</Text>
              <View style={styles.queueActionsRow}>
                <View style={styles.tripActionButton}>
                  <Button title="Emergency" onPress={openEmergencySupport} color="#dc2626" />
                </View>
              </View>
            </>
          )}

          <Text style={styles.queueTitle}>Pre-Assigned Destination ({DESTINATION_KEY_DAILY_LIMIT}/day)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter destination"
            value={destinationKeyInput}
            onChangeText={setDestinationKeyInput}
          />
          <Text style={styles.queueText}>Available: {destinationKeysRemaining} remaining</Text>
          <Button title="Set Destination" onPress={() => activateDestinationKey().catch(() => null)} />
          {destinationUsage.slice(-DESTINATION_KEY_DAILY_LIMIT).map((entry, index) => (
            <Text key={`${entry.usedAt}-${index}`} style={styles.tripSubtleText}>
              Set to: {entry.destination} ({new Date(entry.usedAt).toLocaleTimeString()})
            </Text>
          ))}
        </View>

        <View style={styles.queueCard}>
          <Text style={styles.queueTitle}>Airport Opportunities and Peak Flight Hours</Text>
          <Text style={styles.queueText}>
            Busy earnings signal: {isBusyEarningsWindow ? 'HIGH EARNINGS WINDOW' : 'NORMAL DEMAND'}
          </Text>
          {AIRPORT_OPPORTUNITY_WINDOWS.map(window => (
            <Text key={`${window.airportCode}-${window.label}`} style={styles.tripSubtleText}>
              {window.airportCode} {window.label}: {window.hours}
            </Text>
          ))}
          <View style={styles.queueActionsRow}>
            {AIRPORT_EARNING_HOTSPOTS.map(hotspot => (
              <View key={hotspot.id} style={styles.tripActionButton}>
                <Button title={hotspot.label} onPress={() => openMapSearch(hotspot.query)} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.queueCard}>
          <Text style={styles.queueTitle}>Trip Preferences</Text>
          <View style={styles.trackingHeaderRow}>
            <Text style={styles.trackingText}>Service dog rides</Text>
            <Switch
              value={tripPreferences.serviceDogEnabled}
              onValueChange={toggleServiceDogPreference}
              disabled={tripPreferencesSaving}
            />
          </View>
          <View style={styles.trackingHeaderRow}>
            <Text style={styles.trackingText}>Teen pickup rides</Text>
            <Switch
              value={tripPreferences.teenPickupEnabled}
              onValueChange={toggleTeenPickupPreference}
              disabled={tripPreferencesSaving}
            />
          </View>
          <Text style={styles.helperNote}>Teen policy is always back-seat only.</Text>
          {tripPreferencesSaving ? <ActivityIndicator size="small" /> : null}
        </View>

        <View style={styles.queueCard}>
          <Text style={styles.queueTitle}>Operations Queue (Airports + Events)</Text>
          <View style={styles.queueActionsRow}>
            <View style={styles.tripActionButton}>
              <Button title="Black Car" onPress={() => setSelectedQueueRideCategory('black_car')} />
            </View>
            <View style={styles.tripActionButton}>
              <Button title="SUV" onPress={() => setSelectedQueueRideCategory('suv')} />
            </View>
          </View>
          {queueLoading ? <ActivityIndicator size="small" /> : null}
          <Text style={styles.queueText}>Selected ride category: {selectedQueueRideCategory.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.queueText}>Queue group: {queueStatus?.queueGroup?.toUpperCase() || 'N/A'}</Text>
          <Text style={styles.queueText}>
            Detected operation: {queueStatus?.isInEventVenue ? 'EVENT' : queueStatus?.isInAirportLot ? 'AIRPORT' : 'CITY'}
          </Text>
          <Text style={styles.queueText}>
            Airport lot detected:{' '}
            {queueStatus?.isInAirportLot
              ? `${queueStatus?.detectedAirport?.code || 'YES'} - ${queueStatus?.detectedAirport?.name || ''}`
              : 'No'}
          </Text>
          {queueStatus?.detectedAirportLot ? (
            <Text style={styles.queueText}>
              Required lot: {queueStatus.detectedAirportLot.lotName} ({queueStatus.detectedAirportLot.inRequiredLot ? 'IN LOT' : 'MOVE TO LOT'})
            </Text>
          ) : null}
          {queueStatus?.pickupZone ? (
            <Text style={styles.queueText}>
              Airport pickup zone: {queueStatus.pickupZone.name} ({queueStatus.pickupZone.code})
            </Text>
          ) : null}
          {queueStatus?.detectedEvent ? (
            <Text style={styles.queueText}>
              Event venue: {queueStatus.detectedEvent.name} ({queueStatus.detectedEvent.queueOpen ? 'QUEUE OPEN' : 'QUEUE CLOSED'})
            </Text>
          ) : null}
          {queueStatus?.eventStagingArea ? (
            <Text style={styles.queueText}>
              Event staging: {queueStatus.eventStagingArea.name}{' '}
              ({queueStatus.eventStagingArea.inRequiredStagingArea ? 'IN STAGING' : 'MOVE TO STAGING'})
            </Text>
          ) : null}
          {queueStatus?.eventPickupLane ? (
            <Text style={styles.queueText}>
              Event pickup lane: {queueStatus.eventPickupLane.name} ({queueStatus.eventPickupLane.code})
            </Text>
          ) : null}
          <Text style={styles.queueText}>
            Enforcement: Airport {queueStatus?.enforcement?.airportQueueStrict ? 'STRICT' : 'SOFT'} | Event{' '}
            {queueStatus?.enforcement?.eventQueueStrict ? 'STRICT' : 'SOFT'}
          </Text>
          <Text style={styles.queueText}>
            Queue status: {queueStatus?.queueEntry ? queueStatus.queueEntry.status.toUpperCase() : 'NOT IN QUEUE'}
          </Text>
          <Text style={styles.queueText}>
            Queue type/group:{' '}
            {queueStatus?.queueEntry
              ? `${queueStatus.queueEntry.queueType.toUpperCase()} / ${queueStatus.queueEntry.queueGroup.toUpperCase()}`
              : 'N/A'}
          </Text>
          <Text style={styles.queueText}>Queue position: {queueStatus?.queueEntry?.position ?? 'N/A'}</Text>
          <Text style={styles.queueText}>Estimated wait: {formatEstimatedWait(queueStatus?.queueEntry?.estimatedWaitMinutes)}</Text>
          {isQueueActionCoolingDown ? (
            <Text style={styles.queueCooldownText}>Action cooldown: retry in {queueActionCooldownSeconds}s</Text>
          ) : null}
          {queueActionMessage ? <Text style={styles.queueActionMessage}>{queueActionMessage}</Text> : null}
          {queueStatus?.queueEntry?.airportCode ? (
            <Text style={styles.queueText}>Queue airport: {queueStatus.queueEntry.airportCode}</Text>
          ) : null}
          {queueStatus?.queueEntry?.eventCode ? (
            <Text style={styles.queueText}>Queue event: {queueStatus.queueEntry.eventCode}</Text>
          ) : null}
          {queueStatus?.queueEntry?.lotCode ? <Text style={styles.queueText}>Lot code: {queueStatus.queueEntry.lotCode}</Text> : null}
          {queueStatus?.queueEntry?.stagingAreaCode ? (
            <Text style={styles.queueText}>Staging code: {queueStatus.queueEntry.stagingAreaCode}</Text>
          ) : null}
          {queueStatus?.queueEntry?.pickupZoneCode ? (
            <Text style={styles.queueText}>Pickup zone/lane code: {queueStatus.queueEntry.pickupZoneCode}</Text>
          ) : null}
          {queueStatus?.queueEntry?.expiresAt ? (
            <Text style={styles.queueText}>Queue expires: {new Date(queueStatus.queueEntry.expiresAt).toLocaleString()}</Text>
          ) : null}
          {!queueStatus?.isInAirportLot && !queueStatus?.isInEventVenue ? (
            <Text style={styles.helperNote}>Move into ORD/MDW lots or supported event staging geofences to join queue.</Text>
          ) : null}

          <View style={styles.queueActionsRow}>
            {(queueStatus?.isInAirportLot || queueStatus?.isInEventVenue) && queueStatus?.queueEntry?.status !== 'waiting' ? (
              <View style={styles.tripActionButton}>
                <Button
                  title={
                    queueActionLoading
                      ? 'Joining...'
                      : isQueueActionCoolingDown
                      ? `Retry in ${queueActionCooldownSeconds}s`
                      : queueStatus?.isInEventVenue
                      ? 'Join Event Queue'
                      : 'Join Airport Queue'
                  }
                  onPress={enterAirportQueue}
                  disabled={
                    queueActionLoading ||
                    isQueueActionCoolingDown ||
                    (queueStatus?.isInEventVenue === true && queueStatus?.detectedEvent?.queueOpen === false)
                  }
                />
              </View>
            ) : null}

            {queueStatus?.queueEntry?.status === 'waiting' ? (
              <View style={styles.tripActionButton}>
                <Button
                  title={queueActionLoading ? 'Leaving...' : isQueueActionCoolingDown ? `Retry in ${queueActionCooldownSeconds}s` : 'Leave Queue'}
                  onPress={() => exitAirportQueue()}
                  color="#dc2626"
                  disabled={queueActionLoading || isQueueActionCoolingDown}
                />
              </View>
            ) : null}

            <View style={styles.tripActionButton}>
              <Button
                title="Refresh Queue"
                onPress={() => refreshAirportQueueStatusThrottled(lastLocation, true)}
                disabled={queueLoading || queueActionLoading}
              />
            </View>
          </View>
        </View>

        <View style={styles.queueCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.queueTitle}>Surge Visibility</Text>
            <Text style={[styles.statusChip, surgeVisibility?.trend === 'rising' ? styles.statusChipOnline : styles.statusChipNeutral]}>
              {surgeVisibility?.trend ? surgeVisibility.trend.toUpperCase() : 'NO DATA'}
            </Text>
          </View>
          <View style={styles.queueActionsRow}>
            <View style={styles.tripActionButton}>
              <Button title="Black Car" onPress={() => setSelectedSurgeCategory('black_car')} />
            </View>
            <View style={styles.tripActionButton}>
              <Button title="SUV" onPress={() => setSelectedSurgeCategory('suv')} />
            </View>
          </View>
          {surgeLoading ? <ActivityIndicator size="small" /> : null}
          <Text style={styles.queueText}>Selected category: {selectedSurgeCategory.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.queueText}>Current surge: x{Number(surgeVisibility?.surgeMultiplier || 1).toFixed(2)}</Text>
          <Text style={styles.queueText}>Demand ratio: {Number(surgeVisibility?.demandRatio || 1).toFixed(2)}</Text>
          <Text style={styles.queueText}>
            Demand / supply: {surgeVisibility?.demandCount ?? 0} / {surgeVisibility?.supplyCount ?? 0}
          </Text>
          <Text style={styles.queueText}>Radius: {Number(surgeVisibility?.surgeRadiusKm || 0).toFixed(1)} km</Text>
          <Text style={styles.queueText}>
            Sensitivity / max: {Number(surgeVisibility?.sensitivity || surgeVisibility?.transparency?.sensitivity || 0).toFixed(2)} /
            {' '}x{Number(surgeVisibility?.maxMultiplier || surgeVisibility?.transparency?.maxMultiplier || 0).toFixed(2)}
          </Text>
          <Text style={styles.queueText}>Formula: {surgeVisibility?.transparency?.formula || '1 + (demandRatio - 1) * sensitivity'}</Text>
          {surgeVisibility?.categories ? (
            <Text style={styles.queueText}>
              Category multipliers: Black Car x{Number(surgeVisibility.categories.black_car?.surgeMultiplier || 1).toFixed(2)} | SUV x{Number(
                surgeVisibility.categories.suv?.surgeMultiplier || 1
              ).toFixed(2)}
            </Text>
          ) : null}
          {Array.isArray(surgeVisibility?.forecast) && surgeVisibility?.forecast.length ? (
            <Text style={styles.queueText}>
              Forecast: {surgeVisibility.forecast.map(point => `${point.minutesAhead}m x${point.projectedMultiplier.toFixed(2)}`).join('  |  ')}
            </Text>
          ) : null}
          <View style={styles.queueActionsRow}>
            <View style={styles.tripActionButton}>
              <Button title="Refresh Surge" onPress={() => refreshSurgeVisibilityThrottled(lastLocation, true)} disabled={surgeLoading} />
            </View>
          </View>
          {surgeError ? <Text style={styles.errorText}>{surgeError}</Text> : null}
        </View>

        <View style={styles.queueCard}>
          <Text style={styles.queueTitle}>Road Closure Broadcast</Text>
          <TextInput
            style={styles.input}
            placeholder="Road closure details (street, direction, reason)"
            value={roadClosureNote}
            onChangeText={setRoadClosureNote}
          />
          <Text style={styles.tripSubtleText}>Share closures to help nearby drivers reroute faster.</Text>
          <Button
            title={roadClosureLoading ? 'Reporting...' : 'Report Road Closure'}
            onPress={() => reportRoadClosure().catch(() => null)}
            disabled={roadClosureLoading}
          />
        </View>

        {status !== 'approved' ? <Text style={styles.helperNote}>Go online becomes available after approval.</Text> : null}
        {trackingError ? <Text style={styles.errorText}>{trackingError}</Text> : null}
      </View>

      <View style={styles.tripSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.tripSectionTitle}>Multi-State Rules</Text>
          <Text style={[styles.statusChip, styles.statusChipNeutral]}>{multiStateRules?.operatingStates?.join(', ') || 'NOT SET'}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Operating states (comma-separated, e.g., IL, IN, WI)"
          value={operatingStatesInput}
          onChangeText={setOperatingStatesInput}
          autoCapitalize="characters"
        />
        {multiStateSaving ? <ActivityIndicator /> : <Button title="Save State Rules" onPress={saveMultiStateRules} />}
        {multiStateLoading ? <ActivityIndicator size="small" /> : null}
        <Text style={styles.tripSubtleText}>Chauffeur required: {multiStateRules?.requiresChauffeurLicense ? 'Yes' : 'No'}</Text>
        {multiStateRules?.rules?.map(rule => (
          <View key={rule.code} style={styles.tripCard}>
            <Text style={styles.tripText}>
              {rule.code} - {rule.name}
            </Text>
            <Text style={styles.tripText}>Required docs: {rule.requiredDocuments.join(', ')}</Text>
            <Text style={styles.tripText}>Vehicle inspection every: {rule.vehicleInspectionIntervalDays} days</Text>
            <Text style={styles.tripText}>Notes: {rule.notes.join(' | ') || 'N/A'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tripSectionCard}>
        <Text style={styles.tripSectionTitle}>Chauffeur License Verification</Text>
        <TextInput
          style={styles.input}
          placeholder="Chauffeur license number"
          value={chauffeurLicenseNumber}
          onChangeText={setChauffeurLicenseNumber}
          autoCapitalize="characters"
        />
        <TextInput
          style={styles.input}
          placeholder="Issuing state (e.g., IL)"
          value={chauffeurIssuingState}
          onChangeText={setChauffeurIssuingState}
          autoCapitalize="characters"
        />
        <TextInput
          style={styles.input}
          placeholder="Expiry date (YYYY-MM-DD, optional)"
          value={chauffeurExpiresAt}
          onChangeText={setChauffeurExpiresAt}
          autoCapitalize="none"
        />
        {chauffeurLoading ? <ActivityIndicator /> : <Button title="Verify Chauffeur License" onPress={verifyChauffeurLicense} />}
        <Text style={styles.tripSubtleText}>Current status: {chauffeurStatus?.status || 'unverified'}</Text>
        {chauffeurStatus?.verificationNotes ? <Text style={styles.tripSubtleText}>{chauffeurStatus.verificationNotes}</Text> : null}
      </View>
    </ScrollView>
  );
}

type IncomingRequestsProps = NativeStackScreenProps<RootStackParamList, 'IncomingRequests'> & {
  context: OnboardingContext;
};

function IncomingRequestsScreen({ context }: IncomingRequestsProps) {
  const [incomingTrips, setIncomingTrips] = useState<DriverTrip[]>([]);
  const [currentTrip, setCurrentTrip] = useState<DriverTrip | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingTripId, setProcessingTripId] = useState('');
  const [error, setError] = useState('');
  const [tripTrackingError, setTripTrackingError] = useState('');
  const [lastRouteSyncAt, setLastRouteSyncAt] = useState<number | null>(null);
  const [tripFeedConnected, setTripFeedConnected] = useState(false);
  const [weeklyPayouts, setWeeklyPayouts] = useState<WeeklyPayoutResponse | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [tripEarnings, setTripEarnings] = useState<TripEarningsItem[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [isEarningsVisible, setIsEarningsVisible] = useState(true);
  const [pendingRiderFeedbackTrip, setPendingRiderFeedbackTrip] = useState<DriverTrip | null>(null);
  const [riderFeedbackForm, setRiderFeedbackForm] = useState<DriverRiderFeedbackForm>({
    overallRating: '5',
    safetyRating: '5',
    respectRating: '5',
    comments: '',
  });
  const [riderFeedbackSubmitting, setRiderFeedbackSubmitting] = useState(false);

  const loadTripRequestsRef = useRef<(() => Promise<void>) | null>(null);
  const tripFeedSocketRef = useRef<Socket | null>(null);
  const lastSyncedRoutePointRef = useRef<DriverCoordinates | null>(null);

  const formatMoney = useCallback((value: number | null | undefined) => {
    return formatMaskedCurrency(value, isEarningsVisible);
  }, [isEarningsVisible]);

  const ensureLocationPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permissionResult = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location Permission',
      message: 'Rydinex Driver needs location access to track trip progress and navigation.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    return permissionResult === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const getCurrentCoordinates = useCallback(async () => {
    const hasPermission = await ensureLocationPermission();
    if (!hasPermission) {
      throw new Error('Location permission was denied.');
    }

    return new Promise<DriverCoordinates>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          const accuracyMeters = Number.isFinite(Number(position.coords.accuracy)) ? Number(position.coords.accuracy) : null;
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters,
            recordedAt: Date.now(),
          });
        },
        locationError => {
          reject(new Error(locationError.message || 'Unable to fetch current location.'));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000,
        }
      );
    });
  }, [ensureLocationPermission]);

  const loadWeeklyPayouts = useCallback(async () => {
    if (!context.driverId) {
      return;
    }

    try {
      setPayoutLoading(true);
      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/payouts/weekly?weeks=8`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load weekly payouts.');
      }

      setWeeklyPayouts(payload);
    } catch (weeklyPayoutError: unknown) {
      const message = weeklyPayoutError instanceof Error ? weeklyPayoutError.message : 'Unable to load weekly payouts.';
      setError(message);
    } finally {
      setPayoutLoading(false);
    }
  }, [context.driverId]);

  const loadTripEarnings = useCallback(async () => {
    if (!context.driverId) {
      return;
    }

    try {
      setEarningsLoading(true);
      const response = await fetch(`${API_BASE_URL}/drivers/${context.driverId}/earnings/trips?limit=6`);
      const payload: TripEarningsResponse = await response.json();

      if (!response.ok) {
        throw new Error((payload as any).message || 'Failed to load trip earnings.');
      }

      setTripEarnings(Array.isArray(payload.earnings) ? payload.earnings : []);
    } catch (earningsError: unknown) {
      const message = earningsError instanceof Error ? earningsError.message : 'Unable to load trip earnings.';
      setError(message);
    } finally {
      setEarningsLoading(false);
    }
  }, [context.driverId]);

  const syncRoutePoint = useCallback(
    async (tripId: string) => {
      if (!context.driverId) {
        return;
      }

      try {
        const coordinates = await getCurrentCoordinates();

        if (
          coordinates.accuracyMeters !== undefined &&
          coordinates.accuracyMeters !== null &&
          coordinates.accuracyMeters > MAX_RELIABLE_GPS_ACCURACY_METERS
        ) {
          setTripTrackingError('GPS accuracy is low. Route sync paused until location improves.');
          return;
        }

        const shouldSync = shouldEmitLocationUpdate(lastSyncedRoutePointRef.current, coordinates, {
          minDistanceMeters: 5,
          minIntervalMs: 4000,
        });

        if (!shouldSync) {
          return;
        }

        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId: context.driverId,
            currentLocation: {
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              accuracyMeters: coordinates.accuracyMeters,
              recordedAt: new Date(coordinates.recordedAt || Date.now()).toISOString(),
            },
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Failed to sync trip route.');
        }

        lastSyncedRoutePointRef.current = coordinates;
        setTripTrackingError('');
        setLastRouteSyncAt(Date.now());
      } catch (routeError: unknown) {
        const message = routeError instanceof Error ? routeError.message : 'Unable to sync route point.';
        setTripTrackingError(message);
      }
    },
    [context.driverId, getCurrentCoordinates]
  );

  const loadTripRequests = useCallback(async () => {
    if (!context.driverId) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [incomingResponse, currentResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/trips/driver/${context.driverId}/incoming`),
        fetch(`${API_BASE_URL}/trips/driver/${context.driverId}/current`),
      ]);

      const incomingPayload = await incomingResponse.json();
      const currentPayload = await currentResponse.json().catch(() => null);

      if (!incomingResponse.ok) {
        throw new Error(incomingPayload.message || 'Failed to load incoming trip requests.');
      }

      if (!currentResponse.ok && currentResponse.status !== 404) {
        throw new Error(currentPayload?.message || 'Failed to load current trip.');
      }

      setIncomingTrips(Array.isArray(incomingPayload) ? incomingPayload : []);
      setCurrentTrip(currentResponse.ok ? currentPayload : null);
    } catch (tripLoadError: unknown) {
      const message = tripLoadError instanceof Error ? tripLoadError.message : 'Unable to load trip requests.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [context.driverId]);

  useEffect(() => {
    loadTripRequestsRef.current = loadTripRequests;
  }, [loadTripRequests]);

  const startCurrentTrip = useCallback(async () => {
    if (!context.driverId || !currentTrip) {
      return;
    }

    try {
      setProcessingTripId(currentTrip._id);
      const coordinates = await getCurrentCoordinates();

      const response = await fetch(`${API_BASE_URL}/trips/${currentTrip._id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: context.driverId,
          currentLocation: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            accuracyMeters: coordinates.accuracyMeters,
            recordedAt: new Date(coordinates.recordedAt || Date.now()).toISOString(),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to start trip.');
      }

      if (loadTripRequestsRef.current) {
        await loadTripRequestsRef.current();
      }
    } catch (startError: unknown) {
      const message = startError instanceof Error ? startError.message : 'Unable to start trip.';
      Alert.alert('Error', message);
    } finally {
      setProcessingTripId('');
    }
  }, [context.driverId, currentTrip, getCurrentCoordinates]);

  const endCurrentTrip = useCallback(async () => {
    if (!context.driverId || !currentTrip) {
      return;
    }

    try {
      setProcessingTripId(currentTrip._id);
      const coordinates = await getCurrentCoordinates();

      const response = await fetch(`${API_BASE_URL}/trips/${currentTrip._id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: context.driverId,
          currentLocation: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            accuracyMeters: coordinates.accuracyMeters,
            recordedAt: new Date(coordinates.recordedAt || Date.now()).toISOString(),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to end trip.');
      }

      Alert.alert('Trip Completed', `Driver earnings: ${formatMoney(payload?.summary?.driverEarnings)}`);
      if (payload?.trip?._id) {
        setPendingRiderFeedbackTrip(payload.trip as DriverTrip);
      }

      if (loadTripRequestsRef.current) {
        await loadTripRequestsRef.current();
      }
      await Promise.all([loadWeeklyPayouts(), loadTripEarnings()]);
    } catch (endError: unknown) {
      const message = endError instanceof Error ? endError.message : 'Unable to end trip.';
      Alert.alert('Error', message);
    } finally {
      setProcessingTripId('');
    }
  }, [context.driverId, currentTrip, formatMoney, getCurrentCoordinates, loadTripEarnings, loadWeeklyPayouts]);

  const submitRiderFeedback = useCallback(async () => {
    if (!context.driverId || !pendingRiderFeedbackTrip?._id) {
      return;
    }

    const overallRating = clampRatingInput(riderFeedbackForm.overallRating);
    const safetyRating = clampRatingInput(riderFeedbackForm.safetyRating);
    const respectRating = clampRatingInput(riderFeedbackForm.respectRating);

    if (!overallRating || !safetyRating || !respectRating) {
      Alert.alert('Rating', 'All ratings must be whole numbers from 1 to 5.');
      return;
    }

    try {
      setRiderFeedbackSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/trips/${pendingRiderFeedbackTrip._id}/driver-feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: context.driverId,
          overallRating,
          safetyRating,
          respectRating,
          comments: riderFeedbackForm.comments.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to submit rider feedback.');
      }

      Alert.alert('Saved', 'Rider feedback submitted successfully.');
      setPendingRiderFeedbackTrip(null);
      setRiderFeedbackForm({
        overallRating: '5',
        safetyRating: '5',
        respectRating: '5',
        comments: '',
      });
    } catch (feedbackError: unknown) {
      const message = feedbackError instanceof Error ? feedbackError.message : 'Unable to submit rider feedback.';
      Alert.alert('Rating', message);
    } finally {
      setRiderFeedbackSubmitting(false);
    }
  }, [context.driverId, pendingRiderFeedbackTrip, riderFeedbackForm]);

  const respondToRequest = useCallback(
    async (tripId: string, action: 'accept' | 'decline') => {
      if (!context.driverId) {
        return;
      }

      try {
        setProcessingTripId(tripId);
        const response = await fetch(`${API_BASE_URL}/trips/${tripId}/driver-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId: context.driverId,
            action,
            declineReason: action === 'decline' ? 'Driver declined request.' : undefined,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || `Failed to ${action} trip request.`);
        }

        await loadTripRequests();
      } catch (responseError: unknown) {
        const message = responseError instanceof Error ? responseError.message : 'Unable to process response.';
        Alert.alert('Error', message);
      } finally {
        setProcessingTripId('');
      }
    },
    [context.driverId, loadTripRequests]
  );

  const navigateToTripDestination = useCallback(async () => {
    if (!currentTrip) {
      Alert.alert('No Trip', 'No active trip destination found.');
      return;
    }

    const targetPoint = currentTrip.status === 'in_progress' ? currentTrip.dropoff : currentTrip.pickup;
    const latitude = Number(targetPoint.latitude);
    const longitude = Number(targetPoint.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Invalid Coordinates', 'Destination coordinates are invalid.');
      return;
    }

    const targetUrl =
      Platform.OS === 'android'
        ? `google.navigation:q=${latitude},${longitude}`
        : `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`;

    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    const canOpenPrimary = await Linking.canOpenURL(targetUrl);

    const openUrl = canOpenPrimary ? targetUrl : fallbackUrl;
    await Linking.openURL(openUrl);
  }, [currentTrip]);

  const refreshEverything = useCallback(async () => {
    await Promise.all([loadTripRequests(), loadWeeklyPayouts(), loadTripEarnings()]);
  }, [loadTripEarnings, loadTripRequests, loadWeeklyPayouts]);

  useEffect(() => {
    refreshEverything().catch(() => null);
    const intervalId = setInterval(() => {
      loadTripRequests().catch(() => null);
    }, 4000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadTripRequests, refreshEverything]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadWeeklyPayouts().catch(() => null);
      loadTripEarnings().catch(() => null);
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadTripEarnings, loadWeeklyPayouts]);

  useEffect(() => {
    if (!context.driverId) {
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    tripFeedSocketRef.current = socket;

    socket.on('connect', () => {
      setTripFeedConnected(true);
      socket.emit('driver:subscribeTrips', { driverId: context.driverId });
    });

    socket.on('trip:incoming', () => {
      loadTripRequests().catch(() => null);
    });

    socket.on('disconnect', () => {
      setTripFeedConnected(false);
    });

    socket.on('connect_error', connectionError => {
      setTripFeedConnected(false);
      setError(connectionError.message || 'Realtime trip feed unavailable.');
    });

    return () => {
      socket.emit('driver:unsubscribeTrips', { driverId: context.driverId });
      socket.disconnect();
      socket.removeAllListeners();
      tripFeedSocketRef.current = null;
      setTripFeedConnected(false);
    };
  }, [context.driverId, loadTripRequests]);

  useEffect(() => {
    if (!currentTrip || !context.driverId) {
      return;
    }

    if (!['driver_accepted', 'driver_arrived_pickup', 'in_progress'].includes(currentTrip.status)) {
      return;
    }

    syncRoutePoint(currentTrip._id);
    const trackingIntervalId = setInterval(() => {
      syncRoutePoint(currentTrip._id);
    }, 5000);

    return () => {
      clearInterval(trackingIntervalId);
    };
  }, [context.driverId, currentTrip, syncRoutePoint]);

  const airportWindows = AIRPORT_OPPORTUNITY_WINDOWS.slice(0, 3);
  const payoutHeadline = weeklyPayouts?.totals?.driverEarnings;
  const currentTripStatusLabel = currentTrip ? currentTrip.status.replace(/_/g, ' ') : 'No active trip';

  return (
    <ScrollView contentContainerStyle={styles.screenContainer}>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.dashboardHeroCard}>
        <Text style={styles.dashboardEyebrow}>Driver Control Center</Text>
        <Text style={styles.dashboardTitle}>Stay ahead of live demand</Text>
        <Text style={styles.tripSubtleText}>Realtime requests, payout visibility, and airport intel in one premium dashboard.</Text>

        <View style={styles.dashboardStatsRow}>
          <View style={styles.dashboardStatCard}>
            <Text style={styles.dashboardStatValue}>{incomingTrips.length}</Text>
            <Text style={styles.dashboardStatLabel}>Incoming now</Text>
          </View>
          <View style={styles.dashboardStatCard}>
            <Text style={styles.dashboardStatValue}>{currentTrip ? currentTrip.status.replace(/_/g, ' ') : 'idle'}</Text>
            <Text style={styles.dashboardStatLabel}>Current status</Text>
          </View>
          <View style={styles.dashboardStatCard}>
            <Text style={styles.dashboardStatValue}>{formatMoney(payoutHeadline)}</Text>
            <Text style={styles.dashboardStatLabel}>Payout window</Text>
          </View>
        </View>
      </View>

      <View style={styles.tripSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.tripSectionTitle}>Realtime Requests</Text>
          <Text style={[styles.statusChip, tripFeedConnected ? styles.statusChipOnline : styles.statusChipOffline]}>
            {tripFeedConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </Text>
        </View>
        <Text style={styles.tripSubtleText}>Requests are pushed instantly when new trips are assigned to you.</Text>
      </View>

      <View style={styles.tripSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.tripSectionTitle}>City Event Hub</Text>
          <Text style={[styles.statusChip, styles.statusChipNeutral]}>LIVE OPS</Text>
        </View>
        <Text style={styles.tripSubtleText}>Strategic time windows to position for higher-value pickup demand.</Text>
        {airportWindows.map(window => (
          <View key={`${window.airportCode}-${window.label}`} style={styles.tripCard}>
            <Text style={styles.tripText}>{window.label}</Text>
            <Text style={styles.tripSubtleText}>{window.airportName}</Text>
            <Text style={styles.tripSubtleText}>{window.hours}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tripSectionCard}>
        <Text style={styles.tripSectionTitle}>Airport Intel</Text>
        <Text style={styles.tripSubtleText}>Fast positioning points to reduce dead miles before the next request wave.</Text>
        {AIRPORT_EARNING_HOTSPOTS.map(hotspot => (
          <View key={hotspot.id} style={styles.tripCard}>
            <Text style={styles.tripText}>{hotspot.label}</Text>
            <Text style={styles.tripSubtleText}>{hotspot.query}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tripSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.tripSectionTitle}>Earnings Visibility</Text>
          <Text style={[styles.statusChip, isEarningsVisible ? styles.statusChipOnline : styles.statusChipOffline]}>
            {isEarningsVisible ? 'VISIBLE' : 'HIDDEN'}
          </Text>
        </View>
        <Text style={styles.tripSubtleText}>Use this eye toggle before handing your phone to riders.</Text>
        <Pressable style={({ pressed }) => [styles.secondarySurfaceButton, pressed ? styles.surfaceButtonPressed : null]} onPress={() => setIsEarningsVisible(previous => !previous)}>
          <Text style={styles.secondarySurfaceButtonText}>{isEarningsVisible ? 'Hide Earnings' : 'Show Earnings'}</Text>
        </Pressable>
      </View>

      <View style={styles.tripSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.tripSectionTitle}>Weekly Payouts</Text>
          {payoutLoading ? <ActivityIndicator size="small" /> : null}
        </View>
        <Text style={styles.tripText}>Total earnings (window): {formatMoney(weeklyPayouts?.totals?.driverEarnings)}</Text>
        <Text style={styles.tripText}>Trips completed: {weeklyPayouts?.totals?.tripCount ?? 0}</Text>
        <Text style={styles.tripText}>
          Next payout: {weeklyPayouts?.nextPayout ? `${weeklyPayouts.nextPayout.weekEnd} (${weeklyPayouts.nextPayout.payoutStatus})` : 'N/A'}
        </Text>

        {weeklyPayouts?.weekly?.slice(0, 4).map(week => (
          <View key={week.weekStart} style={styles.tripCard}>
            <Text style={styles.tripText}>
              {week.weekStart} - {week.weekEnd}
            </Text>
            <Text style={styles.tripText}>Status: {week.payoutStatus.toUpperCase()}</Text>
            <Text style={styles.tripText}>Trips: {week.tripCount}</Text>
            <Text style={styles.tripText}>Earnings: {formatMoney(week.driverEarnings)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tripSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.tripSectionTitle}>Per-Trip Earnings</Text>
          {earningsLoading ? <ActivityIndicator size="small" /> : null}
        </View>
        {tripEarnings.map(item => (
          <View key={item.tripId} style={styles.tripCard}>
            <Text style={styles.tripText}>Trip: {item.tripId.slice(-8)}</Text>
            <Text style={styles.tripText}>Completed: {item.completedAt ? new Date(item.completedAt).toLocaleString() : 'N/A'}</Text>
            <Text style={styles.tripText}>Surge: x{Number(item.surgeMultiplier || 1).toFixed(2)}</Text>
            <Text style={styles.tripText}>Driver earnings: {formatMoney(item.driverEarnings)}</Text>
            <Text style={styles.tripText}>Gross fare: {formatMoney(item.grossFare)}</Text>
            <Text style={styles.tripText}>Commission: {formatMoney(item.platformCommission)}</Text>
          </View>
        ))}
        {!earningsLoading && tripEarnings.length === 0 ? <Text style={styles.tripSubtleText}>No completed trips yet.</Text> : null}
      </View>

      <View style={styles.tripSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.tripSectionTitle}>Current Assigned Trip</Text>
          <Text style={[styles.statusChip, currentTrip ? styles.statusChipOnline : styles.statusChipNeutral]}>{currentTripStatusLabel}</Text>
        </View>
        {currentTrip ? (
          <View style={styles.tripCard}>
            <View style={styles.dashboardStatsRow}>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>{formatMoney(currentTrip.upfrontFare ?? currentTrip.fareEstimate)}</Text>
                <Text style={styles.dashboardStatLabel}>Upfront fare</Text>
              </View>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>{Number(currentTrip.actualDistanceMiles || 0).toFixed(1)} mi</Text>
                <Text style={styles.dashboardStatLabel}>Tracked miles</Text>
              </View>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>{Number(currentTrip.actualDurationMinutes || 0).toFixed(0)} min</Text>
                <Text style={styles.dashboardStatLabel}>Tracked time</Text>
              </View>
            </View>
            <Text style={styles.tripText}>Rider: {currentTrip.rider?.name || 'Unknown rider'}</Text>
            <Text style={styles.tripText}>Pickup: {currentTrip.pickup.address || `${currentTrip.pickup.latitude}, ${currentTrip.pickup.longitude}`}</Text>
            <Text style={styles.tripText}>Dropoff: {currentTrip.dropoff.address || `${currentTrip.dropoff.latitude}, ${currentTrip.dropoff.longitude}`}</Text>
            <Text style={styles.tripText}>Status: {currentTrip.status}</Text>
            <Text style={styles.tripText}>Upfront fare: {formatMoney(currentTrip.upfrontFare ?? currentTrip.fareEstimate)}</Text>
            <Text style={styles.tripText}>Service dog: {currentTrip.serviceDogRequested ? 'Yes' : 'No'}</Text>
            <Text style={styles.tripText}>Service dog fee: {formatMoney(currentTrip.serviceDogFee || 0)}</Text>
            <Text style={styles.tripText}>Teen pickup: {currentTrip.teenPickup ? 'Yes (back seat only)' : 'No'}</Text>
            {currentTrip.specialInstructions ? <Text style={styles.tripText}>Notes: {currentTrip.specialInstructions}</Text> : null}
            <Text style={styles.tripText}>Surge multiplier: x{Number(currentTrip.surgeMultiplier || 1).toFixed(2)}</Text>
            <Text style={styles.tripText}>Driver earnings: {formatMoney(currentTrip.driverEarnings)}</Text>
            <Text style={styles.tripText}>Tracked distance: {Number(currentTrip.actualDistanceMiles || 0).toFixed(2)} mi</Text>
            <Text style={styles.tripText}>Tracked duration: {Number(currentTrip.actualDurationMinutes || 0).toFixed(1)} min</Text>
            <Text style={styles.tripText}>Last route sync: {lastRouteSyncAt ? new Date(lastRouteSyncAt).toLocaleTimeString() : 'Not synced yet'}</Text>

            <View style={styles.surfaceActionRow}>
              <Pressable style={({ pressed }) => [styles.primarySurfaceButton, pressed ? styles.surfaceButtonPressed : null]} onPress={navigateToTripDestination}>
                <Text style={styles.primarySurfaceButtonText}>{currentTrip.status === 'in_progress' ? 'Navigate to Dropoff' : 'Navigate to Pickup'}</Text>
              </Pressable>

              {['driver_accepted', 'driver_arrived_pickup'].includes(currentTrip.status) ? (
                <Pressable style={({ pressed }) => [styles.secondarySurfaceButton, pressed ? styles.surfaceButtonPressed : null, processingTripId === currentTrip._id ? styles.disabledSurfaceButton : null]} onPress={processingTripId === currentTrip._id ? undefined : startCurrentTrip}>
                  <Text style={styles.secondarySurfaceButtonText}>{processingTripId === currentTrip._id ? 'Starting...' : 'Start Trip'}</Text>
                </Pressable>
              ) : null}

              {currentTrip.status === 'in_progress' ? (
                <Pressable style={({ pressed }) => [styles.dangerSurfaceButton, pressed ? styles.surfaceButtonPressed : null, processingTripId === currentTrip._id ? styles.disabledSurfaceButton : null]} onPress={processingTripId === currentTrip._id ? undefined : endCurrentTrip}>
                  <Text style={styles.primarySurfaceButtonText}>{processingTripId === currentTrip._id ? 'Ending...' : 'End Trip'}</Text>
                </Pressable>
              ) : null}
            </View>

            {tripTrackingError ? <Text style={styles.errorText}>{tripTrackingError}</Text> : null}
          </View>
        ) : (
          <Text style={styles.tripSubtleText}>No accepted or assigned trip right now.</Text>
        )}
      </View>

      {pendingRiderFeedbackTrip ? (
        <View style={styles.tripSectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.tripSectionTitle}>Rate Rider</Text>
            <Text style={[styles.statusChip, styles.statusChipNeutral]}>POST-TRIP</Text>
          </View>
          <Text style={styles.tripSubtleText}>Trip: {pendingRiderFeedbackTrip._id.slice(-8)}</Text>
          <Text style={styles.tripSubtleText}>Rider: {pendingRiderFeedbackTrip.rider?.name || 'Unknown rider'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Overall rating (1-5)"
            keyboardType="number-pad"
            value={riderFeedbackForm.overallRating}
            onChangeText={value => setRiderFeedbackForm(previous => ({ ...previous, overallRating: value }))}
            maxLength={1}
          />
          <TextInput
            style={styles.input}
            placeholder="Safety rating (1-5)"
            keyboardType="number-pad"
            value={riderFeedbackForm.safetyRating}
            onChangeText={value => setRiderFeedbackForm(previous => ({ ...previous, safetyRating: value }))}
            maxLength={1}
          />
          <TextInput
            style={styles.input}
            placeholder="Respect rating (1-5)"
            keyboardType="number-pad"
            value={riderFeedbackForm.respectRating}
            onChangeText={value => setRiderFeedbackForm(previous => ({ ...previous, respectRating: value }))}
            maxLength={1}
          />
          <TextInput
            style={styles.input}
            placeholder="Optional comment"
            value={riderFeedbackForm.comments}
            onChangeText={value => setRiderFeedbackForm(previous => ({ ...previous, comments: value }))}
          />
          <Pressable style={({ pressed }) => [styles.primarySurfaceButton, pressed ? styles.surfaceButtonPressed : null, riderFeedbackSubmitting ? styles.disabledSurfaceButton : null]} onPress={riderFeedbackSubmitting ? undefined : () => submitRiderFeedback().catch(() => null)}>
            <Text style={styles.primarySurfaceButtonText}>{riderFeedbackSubmitting ? 'Submitting...' : 'Submit Rider Rating'}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.tripSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.tripSectionTitle}>Incoming Requests</Text>
          <Text style={[styles.statusChip, incomingTrips.length ? styles.statusChipOnline : styles.statusChipNeutral]}>{incomingTrips.length} live</Text>
        </View>
        {incomingTrips.map(trip => (
          <View key={trip._id} style={styles.tripCard}>
            <View style={styles.dashboardStatsRow}>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>{formatMoney(trip.upfrontFare ?? trip.fareEstimate)}</Text>
                <Text style={styles.dashboardStatLabel}>Fare</Text>
              </View>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>x{Number(trip.surgeMultiplier || 1).toFixed(2)}</Text>
                <Text style={styles.dashboardStatLabel}>Surge</Text>
              </View>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>{trip.teenPickup ? 'Teen' : 'Standard'}</Text>
                <Text style={styles.dashboardStatLabel}>Trip type</Text>
              </View>
            </View>
            <Text style={styles.tripText}>Rider: {trip.rider?.name || 'Unknown rider'}</Text>
            <Text style={styles.tripText}>Pickup: {trip.pickup.address || `${trip.pickup.latitude}, ${trip.pickup.longitude}`}</Text>
            <Text style={styles.tripText}>Dropoff: {trip.dropoff.address || `${trip.dropoff.latitude}, ${trip.dropoff.longitude}`}</Text>
            <Text style={styles.tripText}>Upfront fare: {formatMoney(trip.upfrontFare ?? trip.fareEstimate)}</Text>
            <Text style={styles.tripText}>Service dog: {trip.serviceDogRequested ? 'Yes' : 'No'}</Text>
            <Text style={styles.tripText}>Service dog fee: {formatMoney(trip.serviceDogFee || 0)}</Text>
            <Text style={styles.tripText}>Teen pickup: {trip.teenPickup ? 'Yes (back seat only)' : 'No'}</Text>
            {trip.specialInstructions ? <Text style={styles.tripText}>Notes: {trip.specialInstructions}</Text> : null}
            <Text style={styles.tripText}>Surge multiplier: x{Number(trip.surgeMultiplier || 1).toFixed(2)}</Text>
            <Text style={styles.tripText}>Driver earnings: {formatMoney(trip.driverEarnings)}</Text>
            <View style={styles.tripActionRow}>
              <Pressable style={({ pressed }) => [styles.primarySurfaceButton, pressed ? styles.surfaceButtonPressed : null, processingTripId === trip._id ? styles.disabledSurfaceButton : null, styles.tripActionButton]} onPress={processingTripId === trip._id ? undefined : () => respondToRequest(trip._id, 'accept')}>
                <Text style={styles.primarySurfaceButtonText}>{processingTripId === trip._id ? 'Processing...' : 'Accept'}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.dangerSurfaceButton, pressed ? styles.surfaceButtonPressed : null, processingTripId === trip._id ? styles.disabledSurfaceButton : null, styles.tripActionButton]} onPress={processingTripId === trip._id ? undefined : () => respondToRequest(trip._id, 'decline')}>
                <Text style={styles.primarySurfaceButtonText}>{processingTripId === trip._id ? 'Processing...' : 'Decline'}</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {!loading && incomingTrips.length === 0 ? <Text style={styles.tripSubtleText}>No incoming trip requests.</Text> : null}
      </View>

      <Pressable style={({ pressed }) => [styles.secondarySurfaceButton, pressed ? styles.surfaceButtonPressed : null]} onPress={() => refreshEverything().catch(() => null)}>
        <Text style={styles.secondarySurfaceButtonText}>Refresh Driver Data</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: DRIVER_COLORS.background,
  },
  screenContainer: {
    flexGrow: 1,
    padding: 16,
    gap: 12,
    justifyContent: 'center',
    backgroundColor: DRIVER_COLORS.background,
  },
  input: {
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DRIVER_COLORS.surfaceHighest,
    color: DRIVER_COLORS.textPrimary,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: DRIVER_COLORS.textPrimary,
  },
  spacer: {
    height: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: DRIVER_COLORS.textPrimary,
  },
  statusMessage: {
    fontSize: 16,
    marginBottom: 16,
    color: DRIVER_COLORS.textSecondary,
  },
  trackingCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: DRIVER_COLORS.surface,
    gap: 6,
  },
  trackingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
    color: DRIVER_COLORS.textPrimary,
    overflow: 'hidden',
  },
  statusChipOnline: {
    backgroundColor: DRIVER_COLORS.successSoft,
    color: DRIVER_COLORS.successText,
  },
  statusChipOffline: {
    backgroundColor: DRIVER_COLORS.dangerSoft,
    color: DRIVER_COLORS.dangerText,
  },
  statusChipNeutral: {
    backgroundColor: DRIVER_COLORS.neutralSoft,
    color: DRIVER_COLORS.textSecondary,
  },
  trackingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DRIVER_COLORS.textPrimary,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DRIVER_COLORS.textPrimary,
  },
  trackingText: {
    fontSize: 14,
    color: DRIVER_COLORS.textSecondary,
  },
  gpsQualityGood: {
    color: DRIVER_COLORS.successText,
  },
  gpsQualityPoor: {
    color: DRIVER_COLORS.dangerText,
  },
  helperNote: {
    fontSize: 13,
    color: DRIVER_COLORS.textSecondary,
    marginTop: 4,
  },
  queueCard: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: DRIVER_COLORS.surfaceHigh,
    padding: 10,
    gap: 4,
  },
  queueTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DRIVER_COLORS.textPrimary,
  },
  queueText: {
    fontSize: 13,
    color: DRIVER_COLORS.textSecondary,
  },
  queueActionMessage: {
    fontSize: 13,
    color: '#b1c5ff',
    fontWeight: '600',
  },
  queueCooldownText: {
    fontSize: 13,
    color: '#ffb694',
    fontWeight: '700',
  },
  queueActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  mapQuickActionsRail: {
    alignSelf: 'flex-end',
    width: '58%',
    minWidth: 170,
    maxWidth: 240,
    gap: 8,
    marginTop: 6,
  },
  mapQuickActionButton: {
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    color: DRIVER_COLORS.dangerText,
    marginTop: 4,
  },
  tripSectionCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: DRIVER_COLORS.surface,
    gap: 10,
  },
  tripSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DRIVER_COLORS.textPrimary,
  },
  tripCard: {
    borderRadius: 14,
    padding: 10,
    gap: 6,
    backgroundColor: DRIVER_COLORS.surfaceHigh,
  },
  tripText: {
    fontSize: 14,
    color: DRIVER_COLORS.textPrimary,
  },
  tripSubtleText: {
    fontSize: 14,
    color: DRIVER_COLORS.textSecondary,
  },
  tripActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  tripActionButton: {
    flex: 1,
    minWidth: 120,
  },
  surfaceActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  primarySurfaceButton: {
    flex: 1,
    minWidth: 120,
    backgroundColor: DRIVER_COLORS.accent,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondarySurfaceButton: {
    backgroundColor: DRIVER_COLORS.surfaceHighest,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerSurfaceButton: {
    flex: 1,
    minWidth: 120,
    backgroundColor: DRIVER_COLORS.dangerSoft,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surfaceButtonPressed: {
    opacity: 0.86,
  },
  disabledSurfaceButton: {
    opacity: 0.5,
  },
  primarySurfaceButtonText: {
    color: '#fffeff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondarySurfaceButtonText: {
    color: DRIVER_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  dashboardHeroCard: {
    borderRadius: 24,
    backgroundColor: DRIVER_COLORS.surfaceHigh,
    padding: 18,
    gap: 10,
    shadowColor: DRIVER_COLORS.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 8,
  },
  dashboardEyebrow: {
    color: DRIVER_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  dashboardTitle: {
    color: DRIVER_COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  dashboardStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  dashboardStatCard: {
    flex: 1,
    backgroundColor: DRIVER_COLORS.surfaceHighest,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  dashboardStatValue: {
    color: DRIVER_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  dashboardStatLabel: {
    color: DRIVER_COLORS.textSecondary,
    fontSize: 12,
  },
});

export default App;
