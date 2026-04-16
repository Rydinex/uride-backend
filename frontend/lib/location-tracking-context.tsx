import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { LocationPin, LiveLocation, TrackingMetrics } from './location-tracking-service';

export interface LocationTrackingState {
  // Rider locations
  riderPickupPin: LocationPin | null;
  riderDropoffPin: LocationPin | null;
  riderCurrentLocation: LiveLocation | null;

  // Driver locations
  driverCurrentLocation: LiveLocation | null;

  // Tracking data
  trackingMetrics: TrackingMetrics | null;
  isTracking: boolean;
  trackingPhase: 'idle' | 'to_pickup' | 'in_trip' | 'complete';

  // UI state
  showLocationSearch: boolean;
  selectedPinType: 'pickup' | 'dropoff' | null;
  locationHistory: LocationPin[];
}

type LocationTrackingAction =
  | { type: 'SET_RIDER_PICKUP_PIN'; payload: LocationPin }
  | { type: 'SET_RIDER_DROPOFF_PIN'; payload: LocationPin }
  | { type: 'SET_RIDER_LOCATION'; payload: LiveLocation }
  | { type: 'SET_DRIVER_LOCATION'; payload: LiveLocation }
  | { type: 'SET_TRACKING_METRICS'; payload: TrackingMetrics }
  | { type: 'START_TRACKING' }
  | { type: 'STOP_TRACKING' }
  | { type: 'SET_TRACKING_PHASE'; payload: 'idle' | 'to_pickup' | 'in_trip' | 'complete' }
  | { type: 'TOGGLE_LOCATION_SEARCH' }
  | { type: 'SET_SELECTED_PIN_TYPE'; payload: 'pickup' | 'dropoff' | null }
  | { type: 'ADD_TO_LOCATION_HISTORY'; payload: LocationPin }
  | { type: 'CLEAR_PINS' }
  | { type: 'RESET_TRACKING' };

const initialState: LocationTrackingState = {
  riderPickupPin: null,
  riderDropoffPin: null,
  riderCurrentLocation: null,
  driverCurrentLocation: null,
  trackingMetrics: null,
  isTracking: false,
  trackingPhase: 'idle',
  showLocationSearch: false,
  selectedPinType: null,
  locationHistory: [],
};

function locationTrackingReducer(
  state: LocationTrackingState,
  action: LocationTrackingAction
): LocationTrackingState {
  switch (action.type) {
    case 'SET_RIDER_PICKUP_PIN':
      return { ...state, riderPickupPin: action.payload };
    case 'SET_RIDER_DROPOFF_PIN':
      return { ...state, riderDropoffPin: action.payload };
    case 'SET_RIDER_LOCATION':
      return { ...state, riderCurrentLocation: action.payload };
    case 'SET_DRIVER_LOCATION':
      return { ...state, driverCurrentLocation: action.payload };
    case 'SET_TRACKING_METRICS':
      return { ...state, trackingMetrics: action.payload };
    case 'START_TRACKING':
      return { ...state, isTracking: true };
    case 'STOP_TRACKING':
      return { ...state, isTracking: false };
    case 'SET_TRACKING_PHASE':
      return { ...state, trackingPhase: action.payload };
    case 'TOGGLE_LOCATION_SEARCH':
      return { ...state, showLocationSearch: !state.showLocationSearch };
    case 'SET_SELECTED_PIN_TYPE':
      return { ...state, selectedPinType: action.payload };
    case 'ADD_TO_LOCATION_HISTORY':
      return {
        ...state,
        locationHistory: [action.payload, ...state.locationHistory].slice(0, 20),
      };
    case 'CLEAR_PINS':
      return { ...state, riderPickupPin: null, riderDropoffPin: null };
    case 'RESET_TRACKING':
      return { ...initialState };
    default:
      return state;
  }
}

interface LocationTrackingContextType {
  state: LocationTrackingState;
  dispatch: React.Dispatch<LocationTrackingAction>;
}

const LocationTrackingContext = createContext<LocationTrackingContextType | undefined>(undefined);

export function LocationTrackingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(locationTrackingReducer, initialState);
  return (
    <LocationTrackingContext.Provider value={{ state, dispatch }}>
      {children}
    </LocationTrackingContext.Provider>
  );
}

export function useLocationTracking() {
  const ctx = useContext(LocationTrackingContext);
  if (!ctx) throw new Error('useLocationTracking must be used within LocationTrackingProvider');
  return ctx;
}
