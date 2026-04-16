import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useSurgePricing } from '@/lib/surge-pricing-context';
import {
  getSurgeZoneAtLocation,
  getDemandText,
  MOCK_SURGE_ZONES,
} from '@/lib/surge-pricing-service';
import { useEffect, useState } from 'react';

export default function SurgePricingScreen() {
  const colors = useColors();
  const { state, dispatch } = useSurgePricing();
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Load all surge zones
    dispatch({ type: 'SET_SURGE_ZONES', payload: MOCK_SURGE_ZONES });

    // Simulate rider location in downtown (high surge)
    const zone = getSurgeZoneAtLocation(37.7749, -122.4194);
    if (zone) {
      setSelectedZone(zone);
      dispatch({ type: 'SET_RIDER_MULTIPLIER', payload: zone.multiplier });

      const explanation =
        zone.multiplier >= 2.5
          ? 'Very high demand in this area. Many riders are requesting rides and few drivers are available.'
          : zone.multiplier >= 2.0
            ? 'High demand. More riders than available drivers right now.'
            : zone.multiplier >= 1.5
              ? 'Moderate demand increase due to peak hours.'
              : 'Normal demand in this area.';

      dispatch({ type: 'SET_RIDER_SURGE_EXPLANATION', payload: explanation });
    }
  }, []);

  const getRecommendation = (multiplier: number) => {
    if (multiplier >= 2.5) return '⏳ Consider waiting a few minutes for surge to decrease';
    if (multiplier >= 2.0) return '📈 Surge pricing is active';
    if (multiplier >= 1.5) return '📊 Slight surge pricing';
    return '✅ Normal pricing';
  };

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Pricing Information</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Understand surge pricing</Text>
        </View>

        {/* Current Zone Surge */}
        {selectedZone && (
          <View
            style={[
              styles.surgeCard,
              {
                backgroundColor: selectedZone.color,
                opacity: 0.15,
                borderColor: selectedZone.color,
              },
            ]}
          >
            <View style={styles.surgeCardTop}>
              <View>
                <Text style={[styles.surgeZoneName, { color: colors.foreground }]}>{selectedZone.name}</Text>
                <Text style={[styles.surgeDemand, { color: colors.muted }]}>
                  {getDemandText(selectedZone.demand)}
                </Text>
              </View>
              <View
                style={[
                  styles.surgeBadge,
                  {
                    backgroundColor: selectedZone.color,
                  },
                ]}
              >
                <Text style={styles.surgeBadgeText}>{selectedZone.multiplier.toFixed(1)}x</Text>
              </View>
            </View>

            <View style={[styles.surgeDivider, { backgroundColor: colors.border }]} />

            <Text style={[styles.surgeExplanation, { color: colors.muted }]}>
              {state.riderSurgeExplanation}
            </Text>

            <View style={[styles.recommendationBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.recommendationText, { color: colors.foreground }]}>
                {getRecommendation(selectedZone.multiplier)}
              </Text>
            </View>
          </View>
        )}

        {/* Pricing Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How Surge Pricing Works</Text>

          <View style={[styles.breakdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>Base Fare</Text>
              <Text style={[styles.breakdownValue, { color: colors.foreground }]}>$2.50</Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>Per Mile</Text>
              <Text style={[styles.breakdownValue, { color: colors.foreground }]}>$1.75</Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.muted }]}>Surge Multiplier</Text>
              <Text style={[styles.breakdownValue, { color: '#FF6B6B' }]}>
                {selectedZone ? `${selectedZone.multiplier.toFixed(1)}x` : '1.0x'}
              </Text>
            </View>
          </View>
        </View>

        {/* Example Calculation */}
        <View style={styles.exampleSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Example Trip</Text>

          <View style={[styles.exampleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.exampleRow}>
              <Text style={[styles.exampleLabel, { color: colors.muted }]}>Distance</Text>
              <Text style={[styles.exampleValue, { color: colors.foreground }]}>3.5 miles</Text>
            </View>

            <View style={[styles.exampleDivider, { backgroundColor: colors.border }]} />

            <View style={styles.exampleRow}>
              <Text style={[styles.exampleLabel, { color: colors.muted }]}>Base Calculation</Text>
              <Text style={[styles.exampleValue, { color: colors.foreground }]}>$8.63</Text>
            </View>

            <View style={[styles.exampleDivider, { backgroundColor: colors.border }]} />

            <View style={styles.exampleRow}>
              <Text style={[styles.exampleLabel, { color: colors.muted }]}>
                With {selectedZone ? selectedZone.multiplier.toFixed(1) : '1.0'}x Surge
              </Text>
              <Text style={[styles.exampleValue, { color: '#FF6B6B', fontWeight: '700' }]}>
                ${selectedZone ? (8.63 * selectedZone.multiplier).toFixed(2) : '8.63'}
              </Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Why Surge Pricing?</Text>

          <View style={[styles.faqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.faqQuestion, { color: colors.foreground }]}>🤔 Why does surge pricing exist?</Text>
            <Text style={[styles.faqAnswer, { color: colors.muted }]}>
              Surge pricing helps balance supply and demand. When many riders need rides and few drivers are available,
              prices increase to incentivize more drivers to get online.
            </Text>
          </View>

          <View style={[styles.faqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.faqQuestion, { color: colors.foreground }]}>⏰ When is surge pricing highest?</Text>
            <Text style={[styles.faqAnswer, { color: colors.muted }]}>
              Surge is typically highest during rush hours (8-9am, 5-6pm), bad weather, or special events when many
              people need rides simultaneously.
            </Text>
          </View>

          <View style={[styles.faqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.faqQuestion, { color: colors.foreground }]}>💰 Can I avoid surge pricing?</Text>
            <Text style={[styles.faqAnswer, { color: colors.muted }]}>
              Yes! Booking rides during off-peak hours (mid-day, late night) typically avoids surge pricing. You can
              also schedule rides in advance.
            </Text>
          </View>
        </View>

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: '#3B82F6' }]}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Transparent Pricing</Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              You'll always see the surge multiplier and estimated fare before confirming your ride.
            </Text>
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
  surgeCard: { borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 2 },
  surgeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  surgeZoneName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  surgeDemand: { fontSize: 12 },
  surgeBadge: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  surgeBadgeText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  surgeDivider: { height: 1, marginVertical: 12 },
  surgeExplanation: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  recommendationBox: { borderRadius: 12, padding: 12, borderWidth: 1 },
  recommendationText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  breakdownSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  breakdownCard: { borderRadius: 12, padding: 16, borderWidth: 1 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  breakdownLabel: { fontSize: 14 },
  breakdownValue: { fontSize: 14, fontWeight: '700' },
  breakdownDivider: { height: 1 },
  exampleSection: { marginBottom: 24 },
  exampleCard: { borderRadius: 12, padding: 16, borderWidth: 1 },
  exampleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  exampleLabel: { fontSize: 14 },
  exampleValue: { fontSize: 14, fontWeight: '700' },
  exampleDivider: { height: 1 },
  faqSection: { marginBottom: 24 },
  faqCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  faqQuestion: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  faqAnswer: { fontSize: 13, lineHeight: 18 },
  infoCard: { borderRadius: 12, padding: 16, marginBottom: 24, flexDirection: 'row', gap: 12, borderWidth: 1 },
  infoIcon: { fontSize: 24 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoText: { fontSize: 12, lineHeight: 16 },
});
