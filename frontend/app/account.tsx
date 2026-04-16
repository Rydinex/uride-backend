import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAppContext } from '@/lib/app-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { Href } from 'expo-router';

export default function AccountScreen() {
  const colors = useColors();
  const { state, dispatch } = useAppContext();
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    router.replace('/auth' as Href);
  };

  const handleSwitchToDriver = () => {
    dispatch({ type: 'SET_ROLE', payload: 'driver' });
    router.replace('/(driver)' as Href);
  };

  const menuItems = [
    { icon: '🛡️', label: 'Safety', subtitle: 'Emergency contacts, safety features' },
    { icon: '🔔', label: 'Notifications', subtitle: 'Manage your notification preferences', hasToggle: true, value: notifications, onToggle: setNotifications },
    { icon: '📍', label: 'Location Sharing', subtitle: 'Share location with trusted contacts', hasToggle: true, value: locationSharing, onToggle: setLocationSharing },
    { icon: '❓', label: 'Help & Support', subtitle: 'FAQs, contact us, report an issue' },
    { icon: '⭐', label: 'Rate the App', subtitle: 'Love Rydinex? Leave a review' },
    { icon: '📋', label: 'Legal', subtitle: 'Terms of service, privacy policy' },
  ];

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: '#1A1A2E' }]}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(state.userName || 'A').charAt(0).toUpperCase()}</Text>
            </View>
            <Pressable style={styles.editAvatarBtn}>
              <Text style={styles.editAvatarIcon}>📷</Text>
            </Pressable>
          </View>
          <Text style={styles.profileName}>{state.userName || 'Alex Johnson'}</Text>
          <Text style={styles.profilePhone}>{state.userPhone || '+1 (555) 000-0000'}</Text>
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>4.9</Text>
              <Text style={styles.profileStatLabel}>Rating ⭐</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>47</Text>
              <Text style={styles.profileStatLabel}>Rides</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <Text style={styles.profileStatValue}>2yr</Text>
              <Text style={styles.profileStatLabel}>Member</Text>
            </View>
          </View>
        </View>

        {/* Switch to Driver */}
        <Pressable
          style={({ pressed }) => [
            styles.switchModeBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleSwitchToDriver}
        >
          <Text style={styles.switchModeIcon}>🚗</Text>
          <View style={styles.switchModeInfo}>
            <Text style={[styles.switchModeTitle, { color: colors.foreground }]}>Switch to Driver Mode</Text>
            <Text style={[styles.switchModeSubtitle, { color: colors.muted }]}>Earn money by driving</Text>
          </View>
          <Text style={[styles.switchModeArrow, { color: colors.muted }]}>›</Text>
        </Pressable>

        {/* Menu Items */}
        <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {menuItems.map((item, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.menuItem,
                { borderBottomColor: colors.border },
                i < menuItems.length - 1 && styles.menuItemBorder,
                pressed && !item.hasToggle && { backgroundColor: 'rgba(0,0,0,0.03)' },
              ]}
            >
              <View style={[styles.menuItemIcon, { backgroundColor: 'rgba(0,212,170,0.1)' }]}>
                <Text style={styles.menuItemIconText}>{item.icon}</Text>
              </View>
              <View style={styles.menuItemInfo}>
                <Text style={[styles.menuItemLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.menuItemSubtitle, { color: colors.muted }]}>{item.subtitle}</Text>
              </View>
              {item.hasToggle ? (
                <Switch
                  value={item.value}
                  onValueChange={item.onToggle}
                  trackColor={{ false: colors.border, true: '#00D4AA' }}
                  thumbColor="white"
                />
              ) : (
                <Text style={[styles.menuItemArrow, { color: colors.muted }]}>›</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.muted }]}>Rydinex v1.0.0</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileHeader: { padding: 24, paddingTop: 60, alignItems: 'center', gap: 8 },
  avatarContainer: { position: 'relative', marginBottom: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(0,212,170,0.3)',
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#0F0F1A' },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00D4AA',
  },
  editAvatarIcon: { fontSize: 12 },
  profileName: { fontSize: 22, fontWeight: '800', color: 'white' },
  profilePhone: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  profileStats: { flexDirection: 'row', marginTop: 12, width: '100%', justifyContent: 'center' },
  profileStat: { flex: 1, alignItems: 'center', gap: 4 },
  profileStatValue: { fontSize: 20, fontWeight: '800', color: 'white' },
  profileStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  profileStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  switchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  switchModeIcon: { fontSize: 28 },
  switchModeInfo: { flex: 1 },
  switchModeTitle: { fontSize: 16, fontWeight: '700' },
  switchModeSubtitle: { fontSize: 13, marginTop: 2 },
  switchModeArrow: { fontSize: 22, fontWeight: '300' },
  menuSection: { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuItemBorder: { borderBottomWidth: 0.5 },
  menuItemIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  menuItemIconText: { fontSize: 20 },
  menuItemInfo: { flex: 1 },
  menuItemLabel: { fontSize: 15, fontWeight: '600' },
  menuItemSubtitle: { fontSize: 12, marginTop: 2 },
  menuItemArrow: { fontSize: 22, fontWeight: '300' },
  logoutBtn: {
    margin: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  version: { textAlign: 'center', fontSize: 12, marginBottom: 24 },
});
