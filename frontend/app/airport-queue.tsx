import { View, Text, StyleSheet, ScrollView, Pressable, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAirportQueue } from '@/lib/airport-queue-context';
import { MOCK_QUEUE_DATA, MOCK_AIRPORTS } from '@/lib/airport-queue-service';
import { useEffect } from 'react';

export default function AirportQueueScreen() {
  const colors = useColors();
  const { state, dispatch } = useAirportQueue();

  useEffect(() => {
    // Simulate loading queue data
    dispatch({ type: 'SET_CURRENT_AIRPORT', payload: MOCK_AIRPORTS[0] });
    dispatch({ type: 'SET_QUEUE_DATA', payload: MOCK_QUEUE_DATA });
    // Simulate driver in queue at position 2
    dispatch({ type: 'SET_DRIVER_QUEUE_POSITION', payload: MOCK_QUEUE_DATA.positions[1] });
  }, []);

  const airport = state.currentAirport;
  const queueData = state.driverQueueData;
  const myPosition = state.driverQueuePosition;

  if (!airport || !queueData || !myPosition) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text style={{ color: colors.foreground, fontSize: 16 }}>Loading queue data...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.airportName, { color: colors.foreground }]}>{airport.code}</Text>
          <Text style={[styles.airportFullName, { color: colors.muted }]}>{airport.name}</Text>
        </View>

        {/* My Position Card */}
        <View style={[styles.myPositionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.myPositionTop}>
            <View style={styles.positionBadge}>
              <Text style={styles.positionNumber}>{myPosition.position}</Text>
              <Text style={styles.positionLabel}>in queue</Text>
            </View>
            <View style={styles.waitInfo}>
              <Text style={[styles.waitTime, { color: colors.foreground }]}>
                {myPosition.estimatedWaitMinutes} min
              </Text>
              <Text style={[styles.waitLabel, { color: colors.muted }]}>estimated wait</Text>
            </View>
          </View>
          <View style={[styles.statusBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.statusProgress,
                { width: `${(myPosition.position / queueData.totalCarsWaiting) * 100}%`, backgroundColor: '#00D4AA' },
              ]}
            />
          </View>
          <Text style={[styles.statusText, { color: colors.muted }]}>
            {queueData.totalCarsWaiting - myPosition.position} cars ahead of you
          </Text>
        </View>

        {/* Queue Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{queueData.totalCarsWaiting}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Total in queue</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{queueData.averageWaitMinutes}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Avg wait (min)</Text>
          </View>
        </View>

        {/* Queue List */}
        <View style={styles.queueSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Queue Position</Text>
          <FlatList
            data={queueData.positions}
            keyExtractor={item => item.driverId}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <View
                style={[
                  styles.queueItem,
                  {
                    backgroundColor: item.driverId === myPosition.driverId ? 'rgba(0,212,170,0.1)' : colors.surface,
                    borderColor:
                      item.driverId === myPosition.driverId ? '#00D4AA' : colors.border,
                  },
                ]}
              >
                <View style={styles.queueItemLeft}>
                  <View
                    style={[
                      styles.positionCircle,
                      {
                        backgroundColor:
                          item.driverId === myPosition.driverId ? '#00D4AA' : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.positionCircleText,
                        {
                          color: item.driverId === myPosition.driverId ? '#0F0F1A' : colors.foreground,
                        },
                      ]}
                    >
                      {item.position}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.queueItemDriver, { color: colors.foreground }]}>
                      {item.driverId === myPosition.driverId ? 'You' : `Driver ${item.position}`}
                    </Text>
                    <Text style={[styles.queueItemStatus, { color: colors.muted }]}>
                      {item.status === 'next' ? 'Next in line' : `Wait: ${item.estimatedWaitMinutes} min`}
                    </Text>
                  </View>
                </View>
                {item.status === 'next' && (
                  <View style={styles.nextBadge}>
                    <Text style={styles.nextBadgeText}>NEXT</Text>
                  </View>
                )}
              </View>
            )}
          />
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: 'rgba(0,212,170,0.08)', borderColor: '#00D4AA' }]}>
          <Text style={styles.tipIcon}>💡</Text>
          <View style={styles.tipContent}>
            <Text style={[styles.tipTitle, { color: colors.foreground }]}>Queue Tips</Text>
            <Text style={[styles.tipText, { color: colors.muted }]}>
              Stay alert when you're next in line. Passengers may arrive within 5-10 minutes of their flight landing.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  airportName: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  airportFullName: { fontSize: 14 },
  myPositionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  myPositionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  positionBadge: { alignItems: 'center' },
  positionNumber: { fontSize: 48, fontWeight: '800', color: '#00D4AA', lineHeight: 52 },
  positionLabel: { fontSize: 12, color: 'rgba(0,212,170,0.7)', fontWeight: '600' },
  waitInfo: { alignItems: 'flex-end' },
  waitTime: { fontSize: 32, fontWeight: '700', lineHeight: 36 },
  waitLabel: { fontSize: 12, marginTop: 2 },
  statusBar: { height: 8, borderRadius: 4, marginBottom: 12, overflow: 'hidden' },
  statusProgress: { height: '100%', borderRadius: 4 },
  statusText: { fontSize: 12, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 12, padding: 16, borderWidth: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 12 },
  queueSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  queueItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  positionCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  positionCircleText: { fontSize: 16, fontWeight: '700' },
  queueItemDriver: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  queueItemStatus: { fontSize: 12 },
  nextBadge: { backgroundColor: '#00D4AA', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  nextBadgeText: { fontSize: 10, fontWeight: '700', color: '#0F0F1A' },
  tipsCard: { borderRadius: 12, padding: 16, marginBottom: 24, flexDirection: 'row', gap: 12, borderWidth: 1 },
  tipIcon: { fontSize: 24 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tipText: { fontSize: 12, lineHeight: 16 },
});
