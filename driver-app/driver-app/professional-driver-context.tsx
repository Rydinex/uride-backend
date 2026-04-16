import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { ProfessionalDriver, Vehicle, Document, ComplianceStatus } from './professional-driver-service';

export interface ProfessionalDriverState {
  // Current professional driver
  currentDriver: ProfessionalDriver | null;
  
  // Driver list
  allDrivers: ProfessionalDriver[];
  
  // Vehicles
  currentVehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  
  // Documents
  currentDocuments: Document[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Compliance
  complianceStatus: ComplianceStatus;
  missingDocuments: string[];
}

type ProfessionalDriverAction =
  | { type: 'SET_CURRENT_DRIVER'; payload: ProfessionalDriver | null }
  | { type: 'SET_ALL_DRIVERS'; payload: ProfessionalDriver[] }
  | { type: 'ADD_VEHICLE'; payload: Vehicle }
  | { type: 'UPDATE_VEHICLE'; payload: Vehicle }
  | { type: 'SET_CURRENT_VEHICLES'; payload: Vehicle[] }
  | { type: 'SET_SELECTED_VEHICLE'; payload: Vehicle | null }
  | { type: 'ADD_DOCUMENT'; payload: Document }
  | { type: 'UPDATE_DOCUMENT'; payload: Document }
  | { type: 'SET_CURRENT_DOCUMENTS'; payload: Document[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_COMPLIANCE_STATUS'; payload: ComplianceStatus }
  | { type: 'SET_MISSING_DOCUMENTS'; payload: string[] }
  | { type: 'RESET_DRIVER_STATE' };

const initialState: ProfessionalDriverState = {
  currentDriver: null,
  allDrivers: [],
  currentVehicles: [],
  selectedVehicle: null,
  currentDocuments: [],
  isLoading: false,
  error: null,
  complianceStatus: 'pending',
  missingDocuments: [],
};

function professionalDriverReducer(
  state: ProfessionalDriverState,
  action: ProfessionalDriverAction
): ProfessionalDriverState {
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
    case 'RESET_DRIVER_STATE':
      return { ...initialState };
    default:
      return state;
  }
}

interface ProfessionalDriverContextType {
  state: ProfessionalDriverState;
  dispatch: React.Dispatch<ProfessionalDriverAction>;
}

const ProfessionalDriverContext = createContext<ProfessionalDriverContextType | undefined>(undefined);

export function ProfessionalDriverProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(professionalDriverReducer, initialState);
  return (
    <ProfessionalDriverContext.Provider value={{ state, dispatch }}>
      {children}
    </ProfessionalDriverContext.Provider>
  );
}

export function useProfessionalDriver() {
  const ctx = useContext(ProfessionalDriverContext);
  if (!ctx) throw new Error('useProfessionalDriver must be used within ProfessionalDriverProvider');
  return ctx;
}
