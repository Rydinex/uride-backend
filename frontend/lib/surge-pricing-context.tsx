import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { SurgeZone, SurgeHistory, DriverEarningsProjection } from './surge-pricing-service';

export interface SurgePricingState {
  // Current surge zones
  surgeZones: SurgeZone[];
  currentZone: SurgeZone | null;
  
  // Driver view
  driverCurrentMultiplier: number;
  topSurgeZones: SurgeZone[];
  driverEarningsProjection: DriverEarningsProjection | null;
  
  // Rider view
  riderCurrentMultiplier: number;
  riderSurgeExplanation: string;
  
  // History and analytics
  surgeHistory: SurgeHistory | null;
  lastUpdated: number;
}

type SurgePricingAction =
  | { type: 'SET_SURGE_ZONES'; payload: SurgeZone[] }
  | { type: 'SET_CURRENT_ZONE'; payload: SurgeZone | null }
  | { type: 'SET_DRIVER_MULTIPLIER'; payload: number }
  | { type: 'SET_TOP_SURGE_ZONES'; payload: SurgeZone[] }
  | { type: 'SET_DRIVER_EARNINGS_PROJECTION'; payload: DriverEarningsProjection | null }
  | { type: 'SET_RIDER_MULTIPLIER'; payload: number }
  | { type: 'SET_RIDER_SURGE_EXPLANATION'; payload: string }
  | { type: 'SET_SURGE_HISTORY'; payload: SurgeHistory | null }
  | { type: 'UPDATE_LAST_UPDATED'; payload: number }
  | { type: 'RESET_SURGE_STATE' };

const initialState: SurgePricingState = {
  surgeZones: [],
  currentZone: null,
  driverCurrentMultiplier: 1.0,
  topSurgeZones: [],
  driverEarningsProjection: null,
  riderCurrentMultiplier: 1.0,
  riderSurgeExplanation: '',
  surgeHistory: null,
  lastUpdated: Date.now(),
};

function surgePricingReducer(state: SurgePricingState, action: SurgePricingAction): SurgePricingState {
  switch (action.type) {
    case 'SET_SURGE_ZONES':
      return { ...state, surgeZones: action.payload };
    case 'SET_CURRENT_ZONE':
      return { ...state, currentZone: action.payload };
    case 'SET_DRIVER_MULTIPLIER':
      return { ...state, driverCurrentMultiplier: action.payload };
    case 'SET_TOP_SURGE_ZONES':
      return { ...state, topSurgeZones: action.payload };
    case 'SET_DRIVER_EARNINGS_PROJECTION':
      return { ...state, driverEarningsProjection: action.payload };
    case 'SET_RIDER_MULTIPLIER':
      return { ...state, riderCurrentMultiplier: action.payload };
    case 'SET_RIDER_SURGE_EXPLANATION':
      return { ...state, riderSurgeExplanation: action.payload };
    case 'SET_SURGE_HISTORY':
      return { ...state, surgeHistory: action.payload };
    case 'UPDATE_LAST_UPDATED':
      return { ...state, lastUpdated: action.payload };
    case 'RESET_SURGE_STATE':
      return { ...initialState };
    default:
      return state;
  }
}

interface SurgePricingContextType {
  state: SurgePricingState;
  dispatch: React.Dispatch<SurgePricingAction>;
}

const SurgePricingContext = createContext<SurgePricingContextType | undefined>(undefined);

export function SurgePricingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(surgePricingReducer, initialState);
  return (
    <SurgePricingContext.Provider value={{ state, dispatch }}>
      {children}
    </SurgePricingContext.Provider>
  );
}

export function useSurgePricing() {
  const ctx = useContext(SurgePricingContext);
  if (!ctx) throw new Error('useSurgePricing must be used within SurgePricingProvider');
  return ctx;
}
