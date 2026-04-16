import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export type UserRole = 'rider' | 'driver' | null;
export type DriverStatus = 'offline' | 'online' | 'on_trip';
export type RideStatus = 
  | 'idle' 
  | 'searching' 
  | 'driver_found' 
  | 'driver_en_route' 
  | 'driver_arrived' 
  | 'in_progress' 
  | 'completed';

export type RideType = 'Rydinex' | 'Rydinex XL' | 'Comfort' | 'Black';

export interface Driver {
  id: string;
  name: string;
  photo: string;
  rating: number;
  vehicle: string;
  vehicleColor: string;
  licensePlate: string;
  eta: number; // minutes
  location: { latitude: number; longitude: number };
}

export interface RideRequest {
  id: string;
  riderId: string;
  riderName: string;
  pickup: { latitude: number; longitude: number; address: string };
  dropoff: { latitude: number; longitude: number; address: string };
  fare: number;
  distance: string;
  duration: string;
}

export interface AppState {
  // Auth
  isAuthenticated: boolean;
  userRole: UserRole;
  userName: string;
  userPhone: string;
  userPhoto: string;
  userRating: number;
  
  // Rider state
  rideStatus: RideStatus;
  destination: { latitude: number; longitude: number; address: string } | null;
  selectedRideType: RideType;
  estimatedFare: number;
  activeDriver: Driver | null;
  
  // Driver state
  driverStatus: DriverStatus;
  pendingRequest: RideRequest | null;
  activeRequest: RideRequest | null;
  todayEarnings: number;
  weekEarnings: number;
  totalTrips: number;
  
  // Shared
  currentLocation: { latitude: number; longitude: number } | null;
  walletBalance: number;
  promoCode: string;
}

type AppAction =
  | { type: 'SET_AUTH'; payload: { name: string; phone: string; role: UserRole } }
  | { type: 'SET_ROLE'; payload: UserRole | 'rider' | 'driver' }
  | { type: 'SET_LOCATION'; payload: { latitude: number; longitude: number } }
  | { type: 'SET_DESTINATION'; payload: { latitude: number; longitude: number; address: string } | null }
  | { type: 'SET_RIDE_TYPE'; payload: RideType }
  | { type: 'SET_RIDE_STATUS'; payload: RideStatus }
  | { type: 'SET_ACTIVE_DRIVER'; payload: Driver | null }
  | { type: 'SET_DRIVER_STATUS'; payload: DriverStatus }
  | { type: 'SET_PENDING_REQUEST'; payload: RideRequest | null }
  | { type: 'SET_ACTIVE_REQUEST'; payload: RideRequest | null }
  | { type: 'ADD_EARNINGS'; payload: number }
  | { type: 'LOGOUT' };

const initialState: AppState = {
  isAuthenticated: false,
  userRole: null,
  userName: '',
  userPhone: '',
  userPhoto: '',
  userRating: 4.9,
  rideStatus: 'idle',
  destination: null,
  selectedRideType: 'Rydinex',
  estimatedFare: 0,
  activeDriver: null,
  driverStatus: 'offline',
  pendingRequest: null,
  activeRequest: null,
  todayEarnings: 127.50,
  weekEarnings: 843.20,
  totalTrips: 1247,
  currentLocation: null,
  walletBalance: 25.00,
  promoCode: '',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_AUTH':
      return {
        ...state,
        isAuthenticated: true,
        userName: action.payload.name,
        userPhone: action.payload.phone,
        userRole: action.payload.role,
      };
    case 'SET_ROLE':
      return { ...state, userRole: action.payload as UserRole };
    case 'SET_LOCATION':
      return { ...state, currentLocation: action.payload };
    case 'SET_DESTINATION':
      return { ...state, destination: action.payload };
    case 'SET_RIDE_TYPE':
      return { ...state, selectedRideType: action.payload };
    case 'SET_RIDE_STATUS':
      return { ...state, rideStatus: action.payload };
    case 'SET_ACTIVE_DRIVER':
      return { ...state, activeDriver: action.payload };
    case 'SET_DRIVER_STATUS':
      return { ...state, driverStatus: action.payload };
    case 'SET_PENDING_REQUEST':
      return { ...state, pendingRequest: action.payload };
    case 'SET_ACTIVE_REQUEST':
      return { ...state, activeRequest: action.payload };
    case 'ADD_EARNINGS':
      return {
        ...state,
        todayEarnings: state.todayEarnings + action.payload,
        weekEarnings: state.weekEarnings + action.payload,
        totalTrips: state.totalTrips + 1,
      };
    case 'LOGOUT':
      return { ...initialState };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
