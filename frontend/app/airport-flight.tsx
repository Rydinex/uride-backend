import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAirportQueue } from '@/lib/airport-queue-context';
import {
  MOCK_FLIGHTS,
  getFlightStatusText,
  getMinutesUntilArrival,
  formatFlightInfo,
  searchFlightByNumber,
} from '@/lib/airport-queue-service';
import { useEffect, useState } from 'react';

export default function AirportFlightScreen() {
  const colors = useColors();
  const { state, dispatch } = useAirportQueue();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(MOCK_FLIGHTS);
  const [selectedFlight, setSelectedFlight] = useState(state.selectedFlight);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length === 0) {
      setSearchResults(MOCK_FLIGHTS);
    } else {
      const result = searchFlightByNumber(query);
      setSearchResults(result ? [result] : []);
    }
  };

  const handleSelectFlight = (flight: any) => {
    setSelectedFlight(flight);
    dispatch({ type: 'SET_SELECTED_FLIGHT', payload: flight });
    setShowConfirmation(true);
  };

  const handleConfirmFlight = () => {
    setShowConfirmation(false);
    // In a real app, this would proceed to booking
  };

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Track Your Flight</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Enter your flight number to see real-time status
          </Text>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>✈️</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Flight number (e.g., UA456)"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="characters"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => handleSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Flight List */}
        <View style={styles.flightList}>
          {searchResults.length === 0 && searchQuery.length > 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyIcon, { color: colors.muted }]}>✈️</Text>
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No flights found</Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>
                Try searching with a different flight number
              </Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item: flight }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.flightCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selectedFlight?.id === flight.id ? '#00D4AA' : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => handleSelectFlight(flight)}
                >
                  <View style={styles.flightCardTop}>
                    <View style={styles.flightNumber}>
                      <Text style={[styles.airline, { color: colors.muted }]}>{flight.airlineCode}</Text>
                      <Text style={[styles.flightNum, { color: colors.foreground }]}>{flight.flightNumber}</Text>
                    </View>
                    <View style={styles.flightRoute}>
                      <Text style={[styles.airport, { color: colors.foreground }]}>{flight.departureAirport}</Text>
                      <Text style={[styles.arrow, { color: colors.muted }]}>→</Text>
                      <Text style={[styles.airport, { color: colors.foreground }]}>{flight.arrivalAirport}</Text>
                    </View>
                    <View style={styles.flightStatus}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              flight.status === 'landed' || flight.status === 'arrived'
                                ? 'rgba(34,197,94,0.1)'
                                : 'rgba(59,130,246,0.1)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color:
                                flight.status === 'landed' || flight.status === 'arrived'
                                  ? '#22C55E'
                                  : '#3B82F6',
                            },
                          ]}
                        >
                          {getFlightStatusText(flight)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <View style={styles.flightCardBottom}>
                    <View style={styles.flightInfo}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Arrival</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>
                        {formatFlightInfo(flight)}
                      </Text>
                    </View>
                    {flight.gate && (
                      <View style={styles.flightInfo}>
                        <Text style={[styles.infoLabel, { color: colors.muted }]}>Gate</Text>
                        <Text style={[styles.infoValue, { color: colors.foreground }]}>{flight.gate}</Text>
                      </View>
                    )}
                    {flight.terminal && (
                      <View style={styles.flightInfo}>
                        <Text style={[styles.infoLabel, { color: colors.muted }]}>Terminal</Text>
                        <Text style={[styles.infoValue, { color: colors.foreground }]}>{flight.terminal}</Text>
                      </View>
                    )}
                  </View>

                  {selectedFlight?.id === flight.id && (
                    <View style={styles.selectedCheck}>
                      <Text style={styles.selectedCheckText}>✓</Text>
                    </View>
                  )}
                </Pressable>
              )}
            />
          )}
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: 'rgba(0,212,170,0.08)', borderColor: '#00D4AA' }]}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <View style={styles.infoCardContent}>
            <Text style={[styles.infoCardTitle, { color: colors.foreground }]}>Queue Booking</Text>
            <Text style={[styles.infoCardText, { color: colors.muted }]}>
              Once you select your flight, you'll be added to the airport queue. Drivers will see your flight info and
              estimated arrival.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      {selectedFlight && (
        <Modal visible={showConfirmation} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Confirm Flight</Text>

              <View style={[styles.modalFlightCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.modalFlightNumber, { color: colors.foreground }]}>
                  {selectedFlight.airlineCode}{selectedFlight.flightNumber}
                </Text>
                <Text style={[styles.modalFlightRoute, { color: colors.muted }]}>
                  {selectedFlight.departureAirport} → {selectedFlight.arrivalAirport}
                </Text>
                <Text style={[styles.modalFlightStatus, { color: '#3B82F6' }]}>
                  {getFlightStatusText(selectedFlight)}
                </Text>
                <Text style={[styles.modalFlightTime, { color: colors.foreground }]}>
                  {formatFlightInfo(selectedFlight)}
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <Pressable
                  style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setShowConfirmation(false)}
                >
                  <Text style={[styles.modalCancelText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.modalConfirmBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleConfirmFlight}
                >
                  <Text style={styles.modalConfirmText}>Book Ride</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 24,
    borderWidth: 1,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  clearBtn: { fontSize: 18, padding: 4 },
  flightList: { marginBottom: 24 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySubtext: { fontSize: 14 },
  flightCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    position: 'relative',
  },
  flightCardTop: { marginBottom: 12 },
  flightNumber: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  airline: { fontSize: 12, fontWeight: '600' },
  flightNum: { fontSize: 18, fontWeight: '700' },
  flightRoute: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  airport: { fontSize: 14, fontWeight: '600' },
  arrow: { fontSize: 12 },
  flightStatus: { marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  divider: { height: 1, marginVertical: 12 },
  flightCardBottom: { flexDirection: 'row', gap: 16 },
  flightInfo: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '700' },
  selectedCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckText: { fontSize: 16, fontWeight: '700', color: '#0F0F1A' },
  infoCard: { borderRadius: 12, padding: 16, marginBottom: 24, flexDirection: 'row', gap: 12, borderWidth: 1 },
  infoIcon: { fontSize: 20 },
  infoCardContent: { flex: 1 },
  infoCardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoCardText: { fontSize: 12, lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalFlightCard: { borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1 },
  modalFlightNumber: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalFlightRoute: { fontSize: 14, marginBottom: 8 },
  modalFlightStatus: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  modalFlightTime: { fontSize: 14, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  modalCancelText: { fontSize: 16, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, backgroundColor: '#00D4AA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText: { fontSize: 16, fontWeight: '700', color: '#0F0F1A' },
});
