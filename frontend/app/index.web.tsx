import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat, withSequence } from 'react-native-reanimated';
import { useAppContext } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { MOCK_RIDE_REQUEST } from '@/lib/mock-data';
import * as Haptics from 'expo-haptics';
import { useNotifications } from '@/lib/notification-context';

const { width, height } = Dimensions.get('window');

const SURGE_ZONES = [
  { lat: 41.88, lng: -87.63, multiplier: 2.25, label: '+$2.25' },
  { lat: 41.87, lng: -87.62, multiplier: 3.5, label: '+$3.50' },
  { lat: 41.86, lng: -87.64, multiplier: 1.75, label: '+$1.75' },
  { lat: 41.85, lng: -87.61, multiplier: 2.5, label: '+$2.50' },
];

export default function DriverHomeScreenWeb() {
  const { state, dispatch } = useAppContext();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sendRideRequestNotification, sendSurgeAlert } = useNotifications();

  const [showRequest, setShowRequest] = useState(false);
  const [requestTimer, setRequestTimer] = useState(15);
  const [tripPhase, setTripPhase] = useState<'idle' | 'to_pickup' | 'in_trip' | 'complete'>('idle');

  const toggleScale = useSharedValue(1);
  const requestSlide = useSharedValue(height);
  const pulseScale = useSharedValue(1);

  // Simulate incoming request when online
  useEffect(() => {
    if (state.driverStatus === 'online' && tripPhase === 'idle') {
      const t = setTimeout(() => {
        setShowRequest(true);
        requestSlide.value = withSpring(0, { damping: 15 });
        setRequestTimer(15);
        sendRideRequestNotification({
          title: '🚗 New Ride Request',
          body: `${MOCK_RIDE_REQUEST.pickup.address} to ${MOCK_RIDE_REQUEST.dropoff.address}`,
          type: 'ride_request',
          rideId: MOCK_RIDE_REQUEST.id,
          pickupAddress: MOCK_RIDE_REQUEST.pickup.address,
          dropoffAddress: MOCK_RIDE_REQUEST.dropoff.address,
          estimatedFare: MOCK_RIDE_REQUEST.fare,
          estimatedDistance: parseFloat(MOCK_RIDE_REQUEST.distance),
          expiresIn: 15,
        }).catch((err: any) => console.error('Failed to send notification:', err));
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [state.driverStatus, tripPhase, sendRideRequestNotification, sendSurgeAlert]);

  // Request countdown
  useEffect(() => {
    if (showRequest && requestTimer > 0) {
      const t = setTimeout(() => setRequestTimer(r => r - 1), 1000);
      return () => clearTimeout(t);
    } else if (showRequest && requestTimer === 0) {
      declineRequest();
    }
  }, [showRequest, requestTimer]);

  // Pulse animation when online
  useEffect(() => {
    if (state.driverStatus === 'online') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1
      );
    } else {
      pulseScale.value = withTiming(1);
    }
  }, [state.driverStatus]);

  const toggleOnline = () => {
    toggleScale.value = withSequence(withTiming(0.92, { duration: 80 }), withSpring(1, { damping: 10 }));
    const newStatus = state.driverStatus === 'offline' ? 'online' : 'offline';
    dispatch({ type: 'SET_DRIVER_STATUS', payload: newStatus });
    if (newStatus === 'offline') {
      setShowRequest(false);
      setTripPhase('idle');
    } else if (newStatus === 'online') {
      const randomSurge = SURGE_ZONES[Math.floor(Math.random() * SURGE_ZONES.length)];
      sendSurgeAlert({
        title: '⚡ Surge Pricing Alert',
        body: `${(randomSurge.multiplier * 100).toFixed(0)}% surge detected nearby`,
        type: 'surge_alert',
        zoneId: `zone_${randomSurge.lat}_${randomSurge.lng}`,
        multiplier: randomSurge.multiplier,
        location: 'Downtown Chicago',
        estimatedEarnings: randomSurge.multiplier * 15,
      }).catch((err: any) => console.error('Failed to send surge alert:', err));
    }
  };

  const acceptRequest = () => {
    requestSlide.value = withTiming(height, { duration: 300 });
    setShowRequest(false);
    dispatch({ type: 'SET_ACTIVE_REQUEST', payload: MOCK_RIDE_REQUEST });
    dispatch({ type: 'SET_DRIVER_STATUS', payload: 'on_trip' });
    setTripPhase('to_pickup');
  };

  const declineRequest = () => {
    requestSlide.value = withTiming(height, { duration: 300 });
    setShowRequest(false);
  };

  const toggleStyle = useAnimatedStyle(() => ({ transform: [{ scale: toggleScale.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));
  const requestStyle = useAnimatedStyle(() => ({ transform: [{ translateY: requestSlide.value }] }));

  const isOnline = state.driverStatus !== 'offline';
  const req = state.activeRequest || MOCK_RIDE_REQUEST;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />

      {/* Web Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderEmoji}>🗺️</Text>
        <Text style={styles.mapPlaceholderText}>Map View</Text>
        <Text style={styles.mapPlaceholderSubtext}>Available on iOS and Android</Text>
      </View>

      {/* Top Navigation Bar */}
      <View style={[styles.topNav, { paddingTop: insets.top + 12 }]}>
        {/* Home button (left) */}
        <Pressable style={styles.navButton}>
          <View style={[styles.navButtonCircle, { backgroundColor: '#fff' }]}>
            <Text style={styles.navButtonIcon}>🏠</Text>
          </View>
        </Pressable>

        <View style={{ flex: 1 }} />

        {/* Search button (right) */}
        <Pressable style={styles.navButton}>
          <View style={[styles.navButtonCircle, { backgroundColor: '#fff' }]}>
            <Text style={styles.navButtonIcon}>🔍</Text>
          </View>
        </Pressable>
      </View>

      {/* Right Sidebar Buttons */}
      <View style={[styles.sidebarButtons, { top: insets.top + 80 }]}>
        <Pressable style={[styles.sidebarBtn, { backgroundColor: '#fff' }]}>
          <Text style={styles.sidebarBtnIcon}>☕</Text>
        </Pressable>
        <Pressable style={[styles.sidebarBtn, { backgroundColor: '#fff' }]}>
          <Text style={styles.sidebarBtnIcon}>🆘</Text>
        </Pressable>
        <Pressable style={[styles.sidebarBtn, { backgroundColor: '#fff' }]}>
          <Text style={styles.sidebarBtnIcon}>📊</Text>
        </Pressable>
      </View>

      {/* Center Bottom Toggle */}
      <Animated.View style={[styles.toggleContainer, toggleStyle]}>
        <Animated.View style={[styles.pulsRing, pulseStyle]} />
        <Pressable
          style={[
            styles.toggleButton,
            { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' },
          ]}
          onPress={toggleOnline}
        >
          <Text style={styles.toggleText}>{isOnline ? '🟢' : '⚪'}</Text>
        </Pressable>
      </Animated.View>

      {/* Bottom Status Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.bottomBarIcon}>
          <Text style={styles.bottomBarIconText}>🛡️</Text>
        </Pressable>

        <View style={styles.bottomBarCenter}>
          <Text style={[styles.bottomBarEarnings, { color: colors.foreground }]}>$0.00</Text>
          <Text style={[styles.bottomBarStatus, { color: colors.muted }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        <Pressable style={styles.bottomBarIcon}>
          <Text style={styles.bottomBarIconText}>☰</Text>
        </Pressable>
      </View>

      {/* Ride Request Modal */}
      {showRequest && (
        <Animated.View style={[styles.requestModal, requestStyle]}>
          <View style={[styles.requestContent, { backgroundColor: colors.surface }]}>
            <View style={styles.requestHeader}>
              <Text style={[styles.requestTitle, { color: colors.foreground }]}>
                Ride Request
              </Text>
              <Text style={[styles.requestTimer, { color: colors.muted }]}>
                {requestTimer}s
              </Text>
            </View>

            <View style={styles.requestAddresses}>
              <View style={styles.requestRow}>
                <Text style={styles.requestDot}>📍</Text>
                <View style={styles.requestAddressInfo}>
                  <Text style={[styles.requestAddressLabel, { color: colors.muted }]}>
                    Pickup
                  </Text>
                  <Text style={[styles.requestAddress, { color: colors.foreground }]}>
                    {req.pickup.address}
                  </Text>
                </View>
              </View>

              <View style={[styles.requestConnector, { backgroundColor: colors.border }]} />

              <View style={styles.requestRow}>
                <Text style={styles.requestDot}>🎯</Text>
                <View style={styles.requestAddressInfo}>
                  <Text style={[styles.requestAddressLabel, { color: colors.muted }]}>
                    Dropoff
                  </Text>
                  <Text style={[styles.requestAddress, { color: colors.foreground }]}>
                    {req.dropoff.address}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.requestStats}>
              <View style={styles.requestStat}>
                <Text style={[styles.requestStatValue, { color: colors.foreground }]}>
                  3 min
                </Text>
                <Text style={[styles.requestStatLabel, { color: colors.muted }]}>
                  Away
                </Text>
              </View>
              <View style={[styles.requestStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.requestStat}>
                <Text style={[styles.requestStatValue, { color: colors.foreground }]}>
                  ${req.fare.toFixed(2)}
                </Text>
                <Text style={[styles.requestStatLabel, { color: colors.muted }]}>
                  Fare
                </Text>
              </View>
              <View style={[styles.requestStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.requestStat}>
                <Text style={[styles.requestStatValue, { color: colors.foreground }]}>
                  8 min
                </Text>
                <Text style={[styles.requestStatLabel, { color: colors.muted }]}>
                  Trip
                </Text>
              </View>
            </View>

            <View style={styles.requestButtons}>
              <Pressable
                style={[styles.declineBtn, { borderColor: colors.border }]}
                onPress={declineRequest}
              >
                <Text style={styles.declineBtnText}>Decline</Text>
              </Pressable>
              <Pressable style={styles.acceptBtn} onPress={acceptRequest}>
                <Text style={styles.acceptBtnText}>Accept</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    gap: 12,
  },
  mapPlaceholderEmoji: {
    fontSize: 80,
  },
  mapPlaceholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#999',
  },
  topNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 15,
  },
  navButton: {
    padding: 8,
  },
  navButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  navButtonIcon: {
    fontSize: 24,
  },
  sidebarButtons: {
    position: 'absolute',
    right: 12,
    gap: 12,
    zIndex: 10,
  },
  sidebarBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sidebarBtnIcon: {
    fontSize: 28,
  },
  toggleContainer: {
    position: 'absolute',
    bottom: 120,
    left: '50%',
    marginLeft: -60,
    zIndex: 12,
    alignItems: 'center',
  },
  pulsRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#22C55E',
    opacity: 0.3,
  },
  toggleButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  toggleText: {
    fontSize: 48,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#333',
    zIndex: 11,
  },
  bottomBarIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBarIconText: {
    fontSize: 24,
  },
  bottomBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  bottomBarEarnings: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomBarStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  requestModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  requestContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  requestTimer: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestAddresses: {
    gap: 12,
  },
  requestRow: {
    flexDirection: 'row',
    gap: 12,
  },
  requestDot: {
    fontSize: 20,
    marginTop: 2,
  },
  requestAddressInfo: {
    flex: 1,
  },
  requestAddressLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  requestAddress: {
    fontSize: 14,
    fontWeight: '600',
  },
  requestConnector: {
    width: 2,
    height: 20,
    marginLeft: 10,
  },
  requestStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  requestStat: {
    alignItems: 'center',
  },
  requestStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  requestStatDivider: {
    width: 1,
    height: 40,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
