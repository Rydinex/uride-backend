import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { StandardDriver, StandardVehicle, StandardDocument, ComplianceStatus } from './standard-driver-service';

export interface StandardDriverState {
  // Current standard driver
  currentDriver: StandardDriver | null;

  // Driver list
  allDrivers: StandardDriver[];

  // Vehicles
  currentVehicles: StandardVehicle[];
  selectedVehicle: StandardVehicle | null;

  // Documents
  currentDocuments: StandardDocument[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Compliance
  complianceStatus: ComplianceStatus;
  missingDocuments: string[];

  // Earnings
  totalEarnings: number;
  recentRides: Array<{ id: string; fare: number; date: string }>;
}

type StandardDriverAction =
  | { type: 'SET_CURRENT_DRIVER'; payload: StandardDriver | null }
  | { type: 'SET_ALL_DRIVERS'; payload: StandardDriver[] }
  | { type: 'ADD_VEHICLE'; payload: StandardVehicle }
  | { type: 'UPDATE_VEHICLE'; payload: StandardVehicle }
  | { type: 'SET_CURRENT_VEHICLES'; payload: StandardVehicle[] }
  | { type: 'SET_SELECTED_VEHICLE'; payload: StandardVehicle | null }
  | { type: 'ADD_DOCUMENT'; payload: StandardDocument }
  | { type: 'UPDATE_DOCUMENT'; payload: StandardDocument }
  | { type: 'SET_CURRENT_DOCUMENTS'; payload: StandardDocument[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_COMPLIANCE_STATUS'; payload: ComplianceStatus }
  | { type: 'SET_MISSING_DOCUMENTS'; payload: string[] }
  | { type: 'SET_TOTAL_EARNINGS'; payload: number }
  | { type: 'ADD_RECENT_RIDE'; payload: { id: string; fare: number; date: string } }
  | { type: 'RESET_DRIVER_STATE' };

const initialState: StandardDriverState = {
  currentDriver: null,
  allDrivers: [],
  currentVehicles: [],
  selectedVehicle: null,
  currentDocuments: [],
  isLoading: false,
  error: null,
  complianceStatus: 'pending',
  missingDocuments: [],
  totalEarnings: 0,
  recentRides: [],
};

function standardDriverReducer(
  state: StandardDriverState,
  action: StandardDriverAction
): StandardDriverState {
  switch (action.type) {
    case 'SET_CURRENT_DRIVER':
      return { ...state, currentDriver: action.payload };
    case 'SET_ALL_DRIVERS':
      return { ...state, allDrivers: action.payload };
    case 'ADD_VEHICLE':
      return { ...state, currentVehicles: [...state.currentVehicles, action.payload] };
    case 'UPDATE_VEHICLE':
      return {
        ...state,
        currentVehicles: state.currentVehicles.map(v => (v.id === action.payload.id ? action.payload : v)),
      };
    case 'SET_CURRENT_VEHICLES':
      return { ...state, currentVehicles: action.payload };
    case 'SET_SELECTED_VEHICLE':
      return { ...state, selectedVehicle: action.payload };
    case 'ADD_DOCUMENT':
      return { ...state, currentDocuments: [...state.currentDocuments, action.payload] };
    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        currentDocuments: state.currentDocuments.map(d => (d.id === action.payload.id ? action.payload : d)),
      };
    case 'SET_CURRENT_DOCUMENTS':
      return { ...state, currentDocuments: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_COMPLIANCE_STATUS':
      return { ...state, complianceStatus: action.payload };
    case 'SET_MISSING_DOCUMENTS':
      return { ...state, missingDocuments: action.payload };
    case 'SET_TOTAL_EARNINGS':
      return { ...state, totalEarnings: action.payload };
    case 'ADD_RECENT_RIDE':
      return { ...state, recentRides: [action.payload, ...state.recentRides].slice(0, 10) };
    case 'RESET_DRIVER_STATE':
      return { ...initialState };
    default:
      return state;
  }
}

interface StandardDriverContextType {
  state: StandardDriverState;
  dispatch: React.Dispatch<StandardDriverAction>;
}

const StandardDriverContext = createContext<StandardDriverContextType | undefined>(undefined);

export function StandardDriverProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(standardDriverReducer, initialState);
  return (
    <StandardDriverContext.Provider value={{ state, dispatch }}>
      {children}
    </StandardDriverContext.Provider>
  );
}

export function useStandardDriver() {
  const ctx = useContext(StandardDriverContext);
  if (!ctx) throw new Error('useStandardDriver must be used within StandardDriverProvider');
  return ctx;
}
