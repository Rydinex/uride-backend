import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState, useRef } from 'react';
import { useAppContext } from '@/lib/app-context';
import type { Href } from 'expo-router';

export default function OTPScreen() {
  const router = useRouter();
  const { state, dispatch } = useAppContext();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const isComplete = otp.every(d => d !== '');

  const handleVerify = () => {
    // Auto-verify with any 6-digit code for demo
    dispatch({
      type: 'SET_AUTH',
      payload: {
        name: 'Alex Johnson',
        phone: '+1 (555) 000-0000',
        role: state.userRole,
      },
    });
    router.push('/auth/profile' as Href);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0F0F1A', '#1A1A2E']} style={StyleSheet.absoluteFillObject} />

        <View style={styles.header}>
          <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.step}>Step 3 of 3</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Enter{'\n'}verification code</Text>
          <Text style={styles.subtitle}>We sent a code to +1 (555) 000-0000</Text>

          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={r => { inputs.current[i] = r; }}
                style={[styles.otpBox, digit && styles.otpBoxFilled]}
                value={digit}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={i === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          <Pressable style={({ pressed }) => [styles.resendBtn, pressed && { opacity: 0.6 }]}>
            <Text style={styles.resendText}>Didn't receive it? <Text style={styles.resendLink}>Resend code</Text></Text>
          </Pressable>

          <Text style={styles.hint}>💡 Enter any 6 digits to continue (demo mode)</Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              !isComplete && styles.continueBtnDisabled,
              pressed && isComplete && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleVerify}
            disabled={!isComplete}
          >
            <Text style={[styles.continueBtnText, !isComplete && styles.continueBtnTextDisabled]}>
              Verify & Continue
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
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  otpBox: {
    flex: 1,
    height: 60,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  otpBoxFilled: { borderColor: '#00D4AA', backgroundColor: 'rgba(0,212,170,0.1)' },
  resendBtn: { alignSelf: 'flex-start' },
  resendText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  resendLink: { color: '#00D4AA', fontWeight: '600' },
  hint: { marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
  footer: { paddingHorizontal: 24, paddingBottom: 48 },
  continueBtn: { backgroundColor: '#00D4AA', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  continueBtnText: { fontSize: 17, fontWeight: '700', color: '#0F0F1A' },
  continueBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
});
