import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useStandardDriver } from '@/lib/standard-driver-context';
import { calculateDriverPayout, formatPayout, TIER_PRICING } from '@/lib/standard-driver-service';
import { useState } from 'react';

export default function StandardEarningsScreen() {
  const colors = useColors();
  const { state } = useStandardDriver();
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');

  // Mock earnings data
  const mockRides = [
    { id: '1', fare: 18.50, tier: 'rydinex', date: '2026-03-26', distance: 5.2, time: 12 },
    { id: '2', fare: 24.75, tier: 'comfort', date: '2026-03-26', distance: 7.1, time: 18 },
    { id: '3', fare: 32.00, tier: 'xl', date: '2026-03-26', distance: 9.5, time: 22 },
    { id: '4', fare: 21.30, tier: 'rydinex', date: '2026-03-25', distance: 6.0, time: 14 },
    { id: '5', fare: 28.50, tier: 'comfort', date: '2026-03-25', distance: 8.2, time: 20 },
    { id: '6', fare: 35.75, tier: 'xl', date: '2026-03-24', distance: 10.1, time: 24 },
  ];

  const totalFares = mockRides.reduce((sum, ride) => sum + ride.fare, 0);
  const totalPayouts = mockRides.reduce((sum, ride) => {
    const payout = calculateDriverPayout(ride.fare);
    return sum + payout.driverPayout;
  }, 0);

  const totalFees = mockRides.reduce((sum, ride) => {
    const payout = calculateDriverPayout(ride.fare);
    return sum + payout.subtotalFees;
  }, 0);

  const ridesByTier = {
    rydinex: mockRides.filter(r => r.tier === 'rydinex'),
    comfort: mockRides.filter(r => r.tier === 'comfort'),
    xl: mockRides.filter(r => r.tier === 'xl'),
  };

  const earningsByTier = {
    rydinex: ridesByTier.rydinex.reduce((sum, r) => sum + calculateDriverPayout(r.fare).driverPayout, 0),
    comfort: ridesByTier.comfort.reduce((sum, r) => sum + calculateDriverPayout(r.fare).driverPayout, 0),
    xl: ridesByTier.xl.reduce((sum, r) => sum + calculateDriverPayout(r.fare).driverPayout, 0),
  };

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Earnings</Text>
        </View>

        {/* Time Filter */}
        <View style={styles.filterContainer}>
          {(['today', 'week', 'month', 'all'] as const).map(filter => (
            <Pressable
              key={filter}
              onPress={() => setTimeFilter(filter)}
              style={({ pressed }) => [
                styles.filterButton,
                {
                  backgroundColor: timeFilter === filter ? '#00D4AA' : colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  { color: timeFilter === filter ? '#FFFFFF' : colors.foreground },
                ]}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Total Earnings Card */}
        <View style={[styles.earningsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.earningsLabel, { color: colors.muted }]}>Total Earnings</Text>
          <Text style={[styles.earningsAmount, { color: '#00D4AA' }]}>{formatPayout(totalPayouts)}</Text>
          <Text style={[styles.earningsSubtext, { color: colors.muted }]}>
            {mockRides.length} rides • {formatPayout(totalFares)} total fares
          </Text>
        </View>

        {/* Fee Breakdown */}
        <View style={[styles.breakdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.breakdownTitle, { color: colors.foreground }]}>Earnings Breakdown</Text>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>Total Fares</Text>
              <Text style={[styles.breakdownValue, { color: colors.foreground }]}>{formatPayout(totalFares)}</Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownRight}>
              <Text style={[styles.breakdownPercent, { color: '#00D4AA' }]}>100%</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>Credit Card Fee (2.9% + $0.30)</Text>
              <Text style={[styles.breakdownValue, { color: colors.foreground }]}>
                {formatPayout(mockRides.reduce((sum, r) => sum + calculateDriverPayout(r.fare).creditCardFee, 0))}
              </Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownRight}>
              <Text style={[styles.breakdownPercent, { color: '#FF6B6B' }]}>
                {((mockRides.reduce((sum, r) => sum + calculateDriverPayout(r.fare).creditCardFee, 0) / totalFares) * 100).toFixed(1)}%
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>City Fee (5%)</Text>
              <Text style={[styles.breakdownValue, { color: colors.foreground }]}>
                {formatPayout(mockRides.reduce((sum, r) => sum + calculateDriverPayout(r.fare).cityFee, 0))}
              </Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownRight}>
              <Text style={[styles.breakdownPercent, { color: '#FF6B6B' }]}>5.0%</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>Your Payout (70%)</Text>
              <Text style={[styles.breakdownValue, { color: '#00D4AA', fontWeight: '700' }]}>
                {formatPayout(totalPayouts)}
              </Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownRight}>
              <Text style={[styles.breakdownPercent, { color: '#00D4AA', fontWeight: '700' }]}>70%</Text>
            </View>
          </View>
        </View>

        {/* Earnings by Tier */}
        <View style={styles.tierSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Earnings by Tier</Text>

          {(['rydinex', 'comfort', 'xl'] as const).map((tier: 'rydinex' | 'comfort' | 'xl') => {
            const pricing = TIER_PRICING[tier];
            const rides = ridesByTier[tier];
            const earnings = earningsByTier[tier];

            return (
              <View
                key={tier}
                style={[styles.tierCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.tierHeader}>
                  <View style={styles.tierInfo}>
                    <Text style={styles.tierEmoji}>{pricing.emoji}</Text>
                    <View>
                      <Text style={[styles.tierName, { color: colors.foreground }]}>{pricing.displayName}</Text>
                      <Text style={[styles.tierRides, { color: colors.muted }]}>{rides.length} rides</Text>
                    </View>
                  </View>
                  <Text style={[styles.tierEarnings, { color: '#00D4AA' }]}>{formatPayout(earnings)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Recent Rides */}
        <View style={styles.ridesSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Rides</Text>

          {mockRides.slice(0, 5).map(ride => {
            const payout = calculateDriverPayout(ride.fare);
            const pricing = TIER_PRICING[ride.tier as 'rydinex' | 'comfort' | 'xl'];

            return (
              <View
                key={ride.id}
                style={[styles.rideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.rideLeft}>
                  <Text style={styles.rideEmoji}>{pricing.emoji}</Text>
                  <View>
                    <Text style={[styles.rideTier, { color: colors.foreground }]}>{pricing?.displayName || 'Rydinex'}</Text>
                    <Text style={[styles.rideDetails, { color: colors.muted }]}>
                      {ride.distance}mi • {ride.time}min
                    </Text>
                    <Text style={[styles.rideDate, { color: colors.muted }]}>
                      {new Date(ride.date).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.rideRight}>
                  <Text style={[styles.rideFare, { color: colors.foreground }]}>{formatPayout(ride.fare)}</Text>
                  <Text style={[styles.rideEarnings, { color: '#00D4AA' }]}>
                    You earned {formatPayout(payout.driverPayout)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800' },
  filterContainer: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  filterButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  filterButtonText: { fontSize: 12, fontWeight: '600' },
  earningsCard: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  earningsLabel: { fontSize: 13, marginBottom: 4 },
  earningsAmount: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  earningsSubtext: { fontSize: 12 },
  breakdownCard: { borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1 },
  breakdownTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center' },
  breakdownLeft: { flex: 1 },
  breakdownLabel: { fontSize: 12, marginBottom: 2 },
  breakdownValue: { fontSize: 14, fontWeight: '600' },
  breakdownDivider: { width: 1, height: 40, marginHorizontal: 12 },
  breakdownRight: { alignItems: 'flex-end' },
  breakdownPercent: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginVertical: 12 },
  tierSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  tierCard: { borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1 },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierEmoji: { fontSize: 24 },
  tierName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  tierRides: { fontSize: 12 },
  tierEarnings: { fontSize: 16, fontWeight: '700' },
  ridesSection: { marginBottom: 24 },
  rideCard: { borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1 },
  rideLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  rideEmoji: { fontSize: 20 },
  rideTier: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  rideDetails: { fontSize: 11, marginBottom: 2 },
  rideDate: { fontSize: 10 },
  rideRight: { alignItems: 'flex-end' },
  rideFare: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  rideEarnings: { fontSize: 11, fontWeight: '600' },
});
