import React, { createContext, useContext, useState, ReactNode } from 'react';

export type MenuSection = 'hub' | 'work-hub' | 'opportunities' | 'pro-status' | 'refer-friend' | 'vehicle' | 'documents' | 'tax' | 'help' | 'safety' | 'settings';

export interface DriverMenuState {
  currentSection: MenuSection;
  isMenuOpen: boolean;
  unreadNotifications: number;
  referralCode: string;
  referralEarnings: number;
}

type DriverMenuAction =
  | { type: 'SET_SECTION'; payload: MenuSection }
  | { type: 'TOGGLE_MENU' }
  | { type: 'OPEN_MENU' }
  | { type: 'CLOSE_MENU' }
  | { type: 'SET_NOTIFICATIONS'; payload: number }
  | { type: 'SET_REFERRAL_CODE'; payload: string }
  | { type: 'SET_REFERRAL_EARNINGS'; payload: number };

const initialState: DriverMenuState = {
  currentSection: 'hub',
  isMenuOpen: false,
  unreadNotifications: 3,
  referralCode: 'RYDINEX2024',
  referralEarnings: 450,
};

function driverMenuReducer(state: DriverMenuState, action: DriverMenuAction): DriverMenuState {
  switch (action.type) {
    case 'SET_SECTION':
      return { ...state, currentSection: action.payload, isMenuOpen: false };
    case 'TOGGLE_MENU':
      return { ...state, isMenuOpen: !state.isMenuOpen };
    case 'OPEN_MENU':
      return { ...state, isMenuOpen: true };
    case 'CLOSE_MENU':
      return { ...state, isMenuOpen: false };
    case 'SET_NOTIFICATIONS':
      return { ...state, unreadNotifications: action.payload };
    case 'SET_REFERRAL_CODE':
      return { ...state, referralCode: action.payload };
    case 'SET_REFERRAL_EARNINGS':
      return { ...state, referralEarnings: action.payload };
    default:
      return state;
  }
}

interface DriverMenuContextType {
  state: DriverMenuState;
  dispatch: React.Dispatch<DriverMenuAction>;
}

const DriverMenuContext = createContext<DriverMenuContextType | undefined>(undefined);

export function DriverMenuProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = React.useReducer(driverMenuReducer, initialState);
  return (
    <DriverMenuContext.Provider value={{ state, dispatch }}>
      {children}
    </DriverMenuContext.Provider>
  );
}

export function useDriverMenu() {
  const ctx = useContext(DriverMenuContext);
  if (!ctx) throw new Error('useDriverMenu must be used within DriverMenuProvider');
  return ctx;
}
