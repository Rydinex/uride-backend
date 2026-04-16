import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAirportQueue } from '@/lib/airport-queue-context';
import { MOCK_QUEUE_METRICS, MOCK_AIRPORTS } from '@/lib/airport-queue-service';
import { useEffect } from 'react';

const { width } = Dimensions.get('window');

export default function AirportMetricsScreen() {
  const colors = useColors();
  const { state, dispatch } = useAirportQueue();

  useEffect(() => {
    dispatch({ type: 'SET_CURRENT_AIRPORT', payload: MOCK_AIRPORTS[0] });
    dispatch({ type: 'SET_QUEUE_METRICS', payload: MOCK_QUEUE_METRICS });
  }, []);

  const metrics = state.queueMetrics;
  const airport = state.currentAirport;

  if (!metrics || !airport) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text style={{ color: colors.foreground, fontSize: 16 }}>Loading metrics...</Text>
      </ScreenContainer>
    );
  }

  const maxQueueLength = Math.max(...metrics.hourlyData.map(h => h.carsInQueue));

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Queue Analytics</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{airport.code} · Today</Text>
        </View>

        {/* Key Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statIcon, { color: '#00D4AA' }]}>📊</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{metrics.totalPickupsCompleted}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Total Pickups</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statIcon, { color: '#3B82F6' }]}>📈</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{metrics.peakQueueLength}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Peak Queue</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statIcon, { color: '#F59E0B' }]}>⏰</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{metrics.peakHour}:00</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Peak Hour</Text>
          </View>
        </View>

        {/* Busy Bar Chart */}
        <View style={styles.chartSection}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>Queue Activity by Hour</Text>
          <Text style={[styles.chartSubtitle, { color: colors.muted }]}>Cars waiting throughout the day</Text>

          <View style={[styles.busyChart, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartBars}>
              {metrics.hourlyData.map((data, index) => {
                const barHeight = (data.carsInQueue / maxQueueLength) * 150;
                const isPeak = data.hour === metrics.peakHour;
                return (
                  <View key={index} style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: isPeak ? '#FF6B6B' : '#00D4AA',
                        },
                      ]}
                    />
                    <Text style={[styles.barLabel, { color: colors.muted }]}>{data.hour}h</Text>
                    <Text style={[styles.barValue, { color: colors.foreground }]}>{data.carsInQueue}</Text>
                  </View>
                );
              })}
            </View>
            <View style={[styles.chartAxis, { borderTopColor: colors.border }]}>
              <Text style={[styles.axisLabel, { color: colors.muted }]}>0</Text>
              <Text style={[styles.axisLabel, { color: colors.muted }]}>{Math.ceil(maxQueueLength / 2)}</Text>
              <Text style={[styles.axisLabel, { color: colors.muted }]}>{maxQueueLength}</Text>
            </View>
          </View>
        </View>

        {/* Hourly Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={[styles.breakdownTitle, { color: colors.foreground }]}>Hourly Breakdown</Text>

          {metrics.hourlyData.map((data, index) => (
            <View
              key={index}
              style={[styles.breakdownRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.breakdownLeft}>
                <Text style={[styles.breakdownTime, { color: colors.foreground }]}>
                  {String(data.hour).padStart(2, '0')}:00
                </Text>
                <Text style={[styles.breakdownDesc, { color: colors.muted }]}>
                  {data.carsInQueue} cars · {data.averageWaitMinutes} min avg wait
                </Text>
              </View>
              <View style={styles.breakdownRight}>
                <View style={[styles.pickupBadge, { backgroundColor: 'rgba(0,212,170,0.1)' }]}>
                  <Text style={[styles.pickupText, { color: '#00D4AA' }]}>{data.pickupsCompleted}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Insights */}
        <View style={[styles.insightCard, { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: '#3B82F6' }]}>
          <Text style={styles.insightIcon}>💡</Text>
          <View style={styles.insightContent}>
            <Text style={[styles.insightTitle, { color: colors.foreground }]}>Peak Hour Insight</Text>
            <Text style={[styles.insightText, { color: colors.muted }]}>
              {metrics.peakHour}:00 is the busiest hour with {metrics.peakQueueLength} cars in queue. Plan accordingly
              for maximum earnings.
            </Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>Peak hour</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00D4AA' }]} />
            <Text style={[styles.legendText, { color: colors.muted }]}>Normal hours</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 11, textAlign: 'center' },
  chartSection: { marginBottom: 24 },
  chartTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  chartSubtitle: { fontSize: 12, marginBottom: 12 },
  busyChart: { borderRadius: 12, padding: 16, borderWidth: 1 },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 180,
    marginBottom: 12,
  },
  barContainer: { alignItems: 'center', gap: 4, flex: 1 },
  bar: { width: '80%', borderRadius: 4 },
  barLabel: { fontSize: 10, fontWeight: '600' },
  barValue: { fontSize: 11, fontWeight: '700' },
  chartAxis: { borderTopWidth: 1, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 10, fontWeight: '600' },
  breakdownSection: { marginBottom: 24 },
  breakdownTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  breakdownLeft: { flex: 1 },
  breakdownTime: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  breakdownDesc: { fontSize: 12 },
  breakdownRight: { marginLeft: 8 },
  pickupBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pickupText: { fontSize: 12, fontWeight: '700' },
  insightCard: { borderRadius: 12, padding: 16, marginBottom: 24, flexDirection: 'row', gap: 12, borderWidth: 1 },
  insightIcon: { fontSize: 24 },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  insightText: { fontSize: 12, lineHeight: 16 },
  legend: { flexDirection: 'row', gap: 24, paddingBottom: 24 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 2 },
  legendText: { fontSize: 12 },
});
