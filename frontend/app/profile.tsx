import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useAppContext } from '@/lib/app-context';
import type { Href } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const { state, dispatch } = useAppContext();
  const [name, setName] = useState('Alex Johnson');
  const [email, setEmail] = useState('alex@example.com');

  const handleComplete = () => {
    dispatch({ type: 'SET_AUTH', payload: { name, phone: state.userPhone, role: state.userRole } });
    if (state.userRole === 'driver') {
      router.replace('/(driver)' as Href);
    } else {
      router.replace('/(tabs)' as Href);
    }
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
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set up your{'\n'}profile</Text>
          <Text style={styles.subtitle}>Tell us a bit about yourself</Text>

          {/* Avatar */}
          <Pressable style={({ pressed }) => [styles.avatarContainer, pressed && { opacity: 0.8 }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>📷</Text>
            </View>
          </Pressable>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email (optional)</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {state.userRole === 'driver' && (
              <View style={styles.driverNote}>
                <Text style={styles.driverNoteText}>
                  🚗 As a driver, you'll need to complete vehicle verification after setup
                </Text>
              </View>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              !name.trim() && styles.continueBtnDisabled,
              pressed && name.trim() && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleComplete}
            disabled={!name.trim()}
          >
            <Text style={[styles.continueBtnText, !name.trim() && styles.continueBtnTextDisabled]}>
              {state.userRole === 'driver' ? 'Start Driving' : 'Start Riding'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 8 },
  backBtn: { padding: 8, alignSelf: 'flex-start' },
  backText: { fontSize: 24, color: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', lineHeight: 40, marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32 },
  avatarContainer: { alignSelf: 'center', marginBottom: 40, position: 'relative' },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(0,212,170,0.3)',
  },
  avatarInitial: { fontSize: 40, fontWeight: '800', color: '#0F0F1A' },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00D4AA',
  },
  avatarBadgeText: { fontSize: 14 },
  form: { gap: 20, marginBottom: 40 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  driverNote: {
    backgroundColor: 'rgba(0,212,170,0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.2)',
  },
  driverNoteText: { fontSize: 14, color: 'rgba(0,212,170,0.9)', lineHeight: 20 },
  continueBtn: { backgroundColor: '#00D4AA', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  continueBtnText: { fontSize: 17, fontWeight: '700', color: '#0F0F1A' },
  continueBtnTextDisabled: { color: 'rgba(255,255,255,0.3)' },
});
