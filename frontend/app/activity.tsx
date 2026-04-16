import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { MOCK_TRIP_HISTORY } from '@/lib/mock-data';

export default function ActivityScreen() {
  const colors = useColors();

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Activity</Text>
      </View>

      <FlatList
        data={MOCK_TRIP_HISTORY}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.tripCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={styles.tripCardHeader}>
              <View style={[styles.tripTypeIcon, { backgroundColor: 'rgba(0,212,170,0.1)' }]}>
                <Text style={styles.tripTypeEmoji}>🚗</Text>
              </View>
              <View style={styles.tripCardInfo}>
                <Text style={[styles.tripCardDate, { color: colors.muted }]}>{item.date}</Text>
                <Text style={[styles.tripCardType, { color: colors.foreground }]}>{item.rideType}</Text>
              </View>
              <Text style={[styles.tripCardFare, { color: colors.foreground }]}>${item.fare.toFixed(2)}</Text>
            </View>

            <View style={[styles.tripRoute, { borderTopColor: colors.border }]}>
              <View style={styles.routeRow}>
                <View style={styles.routeDot} />
                <Text style={[styles.routeText, { color: colors.foreground }]}>{item.pickup}</Text>
              </View>
              <View style={[styles.routeConnector, { backgroundColor: colors.border }]} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: '#FF6B35' }]} />
                <Text style={[styles.routeText, { color: colors.foreground }]}>{item.dropoff}</Text>
              </View>
            </View>

            <View style={[styles.tripCardFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.tripCardDriver, { color: colors.muted }]}>Driver: {item.driver}</Text>
              <View style={styles.tripRating}>
                {[1, 2, 3, 4, 5].map(s => (
                  <Text key={s} style={[styles.ratingStar, { opacity: s <= item.rating ? 1 : 0.25 }]}>⭐</Text>
                ))}
              </View>
              <Text style={[styles.tripDuration, { color: colors.muted }]}>{item.duration}</Text>
            </View>
          </Pressable>
        )}
        ListHeaderComponent={
          <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>47</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Total Rides</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>$842</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Total Spent</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>4.9⭐</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Avg Rating</Text>
            </View>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 0.5 },
  title: { fontSize: 28, fontWeight: '800' },
  list: { padding: 16, gap: 12 },
  statsRow: { borderRadius: 20, padding: 20, borderWidth: 1, flexDirection: 'row', marginBottom: 4 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '500' },
  statDivider: { width: 1, marginVertical: 4 },
  tripCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  tripCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  tripTypeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tripTypeEmoji: { fontSize: 20 },
  tripCardInfo: { flex: 1 },
  tripCardDate: { fontSize: 12, fontWeight: '500' },
  tripCardType: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  tripCardFare: { fontSize: 18, fontWeight: '800' },
  tripRoute: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, gap: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00D4AA' },
  routeConnector: { width: 1, height: 12, marginLeft: 4.5 },
  routeText: { fontSize: 14, fontWeight: '500' },
  tripCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 16, borderTopWidth: 0.5 },
  tripCardDriver: { fontSize: 12 },
  tripRating: { flexDirection: 'row' },
  ratingStar: { fontSize: 12 },
  tripDuration: { fontSize: 12 },
});
