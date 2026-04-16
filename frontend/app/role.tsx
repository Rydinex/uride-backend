import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { useAppContext } from '@/lib/app-context';
import type { Href } from 'expo-router';
import type { UserRole } from '@/lib/app-context';

export default function RoleScreen() {
  const router = useRouter();
  const { dispatch } = useAppContext();
  const [selected, setSelected] = useState<UserRole>(null);
  const card1Opacity = useSharedValue(0);
  const card2Opacity = useSharedValue(0);

  useEffect(() => {
    card1Opacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    card2Opacity.value = withDelay(400, withTiming(1, { duration: 400 }));
  }, []);

  const card1Style = useAnimatedStyle(() => ({ opacity: card1Opacity.value, transform: [{ translateY: (1 - card1Opacity.value) * 20 }] }));
  const card2Style = useAnimatedStyle(() => ({ opacity: card2Opacity.value, transform: [{ translateY: (1 - card2Opacity.value) * 20 }] }));

  const handleContinue = () => {
    if (!selected) return;
    dispatch({ type: 'SET_ROLE', payload: selected });
    router.push('/auth/phone' as Href);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.step}>Step 1 of 3</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>How will you use{'\n'}Rydinex?</Text>
        <Text style={styles.subtitle}>You can switch between modes anytime</Text>

        <View style={styles.cards}>
          <Animated.View style={card1Style}>
            <Pressable
              style={({ pressed }) => [
                styles.roleCard,
                selected === 'rider' && styles.roleCardSelected,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => setSelected('rider')}
            >
              <Text style={styles.roleEmoji}>🧑‍💼</Text>
              <Text style={[styles.roleTitle, selected === 'rider' && styles.roleTitleSelected]}>I need a ride</Text>
              <Text style={[styles.roleDesc, selected === 'rider' && styles.roleDescSelected]}>
                Book rides to your destination quickly and safely
              </Text>
              {selected === 'rider' && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          <Animated.View style={card2Style}>
            <Pressable
              style={({ pressed }) => [
                styles.roleCard,
                selected === 'driver' && styles.roleCardSelected,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => setSelected('driver')}
            >
              <Text style={styles.roleEmoji}>🚗</Text>
              <Text style={[styles.roleTitle, selected === 'driver' && styles.roleTitleSelected]}>I want to drive</Text>
              <Text style={[styles.roleDesc, selected === 'driver' && styles.roleDescSelected]}>
                Earn money on your schedule driving people around
              </Text>
              {selected === 'driver' && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            !selected && styles.continueBtnDisabled,
            pressed && selected && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={[styles.continueBtnText, !selected && styles.continueBtnTextDisabled]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  backText: { fontSize: 24, color: '#FFFFFF' },
  step: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', lineHeight: 40, marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 40 },
  cards: { gap: 16, marginBottom: 40 },
  roleCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  roleCardSelected: {
    backgroundColor: 'rgba(0,212,170,0.12)',
    borderColor: '#00D4AA',
  },
  roleEmoji: { fontSize: 40, marginBottom: 12 },
  roleTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  roleTitleSelected: { color: '#00D4AA' },
  roleDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  roleDescSelected: { color: 'rgba(0,212,170,0.8)' },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: { fontSize: 14, fontWeight: '800', color: '#0F0F1A' },
  continueBtn: {
    backgroundColor: '#00D4AA',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  continueBtnText: { fontSize: 17, fontWeight: '700', color: '#0F0F1A' },
  continueBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
});
