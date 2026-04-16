import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import type { Href } from 'expo-router';

const COUNTRY_CODE = '+1';

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const rawDigits = phone.replace(/\D/g, '');
  const isValid = rawDigits.length === 10;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFillObject} />

        <View style={styles.header}>
          <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.step}>Step 2 of 3</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>What's your{'\n'}phone number?</Text>
          <Text style={styles.subtitle}>We'll send you a verification code</Text>

          <View style={styles.inputRow}>
            <View style={styles.countryCode}>
              <Text style={styles.flag}>🇺🇸</Text>
              <Text style={styles.code}>{COUNTRY_CODE}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => setPhone(formatPhone(t))}
              placeholder="(555) 000-0000"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="phone-pad"
              returnKeyType="done"
              autoFocus
              maxLength={14}
            />
          </View>

          <Text style={styles.disclaimer}>
            Standard message and data rates may apply. By providing your phone number, you agree to receive SMS messages from Rydinex.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              !isValid && styles.continueBtnDisabled,
              pressed && isValid && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => isValid && router.push('/auth/otp' as Href)}
            disabled={!isValid}
          >
            <Text style={[styles.continueBtnText, !isValid && styles.continueBtnTextDisabled]}>
              Send Code
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', lineHeight: 40, marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 40 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  countryCode: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.15)', paddingVertical: 18 },
  flag: { fontSize: 20 },
  code: { fontSize: 17, color: '#FFFFFF', fontWeight: '600' },
  input: {
    flex: 1,
    fontSize: 20,
    color: '#FFFFFF',
    paddingVertical: 18,
    paddingLeft: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
  disclaimer: { fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 18 },
  footer: { paddingHorizontal: 24, paddingBottom: 48 },
  continueBtn: { backgroundColor: '#00D4AA', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  continueBtnText: { fontSize: 17, fontWeight: '700', color: '#0F0F1A' },
  continueBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
});
