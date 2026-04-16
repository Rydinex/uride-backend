import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { Airport, Flight, AirportQueue, QueueMetrics, QueuePosition } from './airport-queue-service';

export interface AirportQueueState {
  // Current airport detection
  currentAirport: Airport | null;
  isInAirportGeofence: boolean;

  // Driver queue state
  driverQueuePosition: QueuePosition | null;
  driverQueueData: AirportQueue | null;

  // Rider flight state
  selectedFlight: Flight | null;
  flightSearchQuery: string;
  searchedFlights: Flight[];

  // Metrics
  queueMetrics: QueueMetrics | null;
}

type AirportQueueAction =
  | { type: 'SET_CURRENT_AIRPORT'; payload: Airport | null }
  | { type: 'SET_GEOFENCE_STATUS'; payload: boolean }
  | { type: 'SET_DRIVER_QUEUE_POSITION'; payload: QueuePosition | null }
  | { type: 'SET_QUEUE_DATA'; payload: AirportQueue | null }
  | { type: 'SET_SELECTED_FLIGHT'; payload: Flight | null }
  | { type: 'SET_FLIGHT_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCHED_FLIGHTS'; payload: Flight[] }
  | { type: 'SET_QUEUE_METRICS'; payload: QueueMetrics | null }
  | { type: 'RESET_AIRPORT_STATE' };

const initialState: AirportQueueState = {
  currentAirport: null,
  isInAirportGeofence: false,
  driverQueuePosition: null,
  driverQueueData: null,
  selectedFlight: null,
  flightSearchQuery: '',
  searchedFlights: [],
  queueMetrics: null,
};

function airportQueueReducer(state: AirportQueueState, action: AirportQueueAction): AirportQueueState {
  switch (action.type) {
    case 'SET_CURRENT_AIRPORT':
      return { ...state, currentAirport: action.payload };
    case 'SET_GEOFENCE_STATUS':
      return { ...state, isInAirportGeofence: action.payload };
    case 'SET_DRIVER_QUEUE_POSITION':
      return { ...state, driverQueuePosition: action.payload };
    case 'SET_QUEUE_DATA':
      return { ...state, driverQueueData: action.payload };
    case 'SET_SELECTED_FLIGHT':
      return { ...state, selectedFlight: action.payload };
    case 'SET_FLIGHT_SEARCH_QUERY':
      return { ...state, flightSearchQuery: action.payload };
    case 'SET_SEARCHED_FLIGHTS':
      return { ...state, searchedFlights: action.payload };
    case 'SET_QUEUE_METRICS':
      return { ...state, queueMetrics: action.payload };
    case 'RESET_AIRPORT_STATE':
      return { ...initialState };
    default:
      return state;
  }
}

interface AirportQueueContextType {
  state: AirportQueueState;
  dispatch: React.Dispatch<AirportQueueAction>;
}

const AirportQueueContext = createContext<AirportQueueContextType | undefined>(undefined);

export function AirportQueueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(airportQueueReducer, initialState);
  return (
    <AirportQueueContext.Provider value={{ state, dispatch }}>
      {children}
    </AirportQueueContext.Provider>
  );
}

export function useAirportQueue() {
  const ctx = useContext(AirportQueueContext);
  if (!ctx) throw new Error('useAirportQueue must be used within AirportQueueProvider');
  return ctx;
}
