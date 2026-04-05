/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-gesture-handler', () => ({}));

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const ReactNative = require('react');
  const { View } = require('react-native');

  const MapComponent = (props: any) => ReactNative.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: MapComponent,
    Marker: MapComponent,
    Polyline: MapComponent,
  };
});

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

const App = require('../App').default;

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
