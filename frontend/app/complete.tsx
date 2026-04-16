import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColors } from '@/hooks/use-colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';

const TIPS = [0, 1, 2, 3, 5];

export default function RideCompleteScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [selectedTip, setSelectedTip] = useState(2);

  const handleDone = () => {
    router.replace('/(tabs)' as Href);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
        {/* Success header */}
        <View style={styles.successHeader}>
          <View style={[styles.checkCircle, { backgroundColor: '#00D4AA' }]}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>You've arrived!</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Hope you enjoyed your ride</Text>
        </View>

        {/* Receipt */}
        <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.receiptTitle, { color: colors.foreground }]}>Trip Summary</Text>
          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.muted }]}>Route</Text>
            <Text style={[styles.receiptValue, { color: colors.foreground }]}>Home → Downtown SF</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.muted }]}>Distance</Text>
            <Text style={[styles.receiptValue, { color: colors.foreground }]}>3.2 mi</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.muted }]}>Duration</Text>
            <Text style={[styles.receiptValue, { color: colors.foreground }]}>18 min</Text>
          </View>
          <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.muted }]}>Base fare</Text>
            <Text style={[styles.receiptValue, { color: colors.foreground }]}>$8.50</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.muted }]}>Tip</Text>
            <Text style={[styles.receiptValue, { color: colors.foreground }]}>${TIPS[selectedTip].toFixed(2)}</Text>
          </View>
          <View style={[styles.receiptDivider, { backgroundColor: colors.border }]} />
          <View style={styles.receiptRow}>
            <Text style={[styles.receiptTotal, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.receiptTotalValue, { color: '#00D4AA' }]}>${(8.50 + TIPS[selectedTip]).toFixed(2)}</Text>
          </View>
        </View>

        {/* Rating */}
        <View style={[styles.ratingSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.ratingTitle, { color: colors.foreground }]}>Rate your driver</Text>
          <Text style={[styles.driverName, { color: colors.muted }]}>Marcus Johnson</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(star => (
              <Pressable
                key={star}
                style={({ pressed }) => [styles.starBtn, pressed && { transform: [{ scale: 1.2 }] }]}
                onPress={() => setRating(star)}
              >
                <Text style={[styles.starIcon, { opacity: star <= rating ? 1 : 0.3 }]}>⭐</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Tip */}
        <View style={[styles.tipSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.tipTitle, { color: colors.foreground }]}>Add a tip</Text>
          <View style={styles.tipButtons}>
            {TIPS.map((tip, i) => (
              <Pressable
                key={i}
                style={[
                  styles.tipBtn,
                  { borderColor: selectedTip === i ? '#00D4AA' : colors.border },
                  selectedTip === i && { backgroundColor: 'rgba(0,212,170,0.1)' },
                ]}
                onPress={() => setSelectedTip(i)}
              >
                <Text style={[styles.tipBtnText, { color: selectedTip === i ? '#00D4AA' : colors.foreground }]}>
                  {tip === 0 ? 'No tip' : `$${tip}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Done button */}
        <Pressable
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
          onPress={handleDone}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.receiptBtn, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.receiptBtnText, { color: '#00D4AA' }]}>View full receipt</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 16 },
  successHeader: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  checkCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  checkIcon: { fontSize: 36, color: '#0F0F1A', fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 16 },
  receipt: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 12 },
  receiptTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptLabel: { fontSize: 15 },
  receiptValue: { fontSize: 15, fontWeight: '500' },
  receiptDivider: { height: 1, marginVertical: 4 },
  receiptTotal: { fontSize: 17, fontWeight: '700' },
  receiptTotalValue: { fontSize: 20, fontWeight: '800' },
  ratingSection: { borderRadius: 20, padding: 20, borderWidth: 1, alignItems: 'center', gap: 8 },
  ratingTitle: { fontSize: 17, fontWeight: '700' },
  driverName: { fontSize: 14 },
  stars: { flexDirection: 'row', gap: 8, marginTop: 8 },
  starBtn: { padding: 4 },
  starIcon: { fontSize: 36 },
  tipSection: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 12 },
  tipTitle: { fontSize: 17, fontWeight: '700' },
  tipButtons: { flexDirection: 'row', gap: 8 },
  tipBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  tipBtnText: { fontSize: 14, fontWeight: '700' },
  doneBtn: { backgroundColor: '#00D4AA', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  doneBtnText: { fontSize: 17, fontWeight: '700', color: '#0F0F1A' },
  receiptBtn: { alignItems: 'center', paddingVertical: 8 },
  receiptBtnText: { fontSize: 15, fontWeight: '600' },
});
