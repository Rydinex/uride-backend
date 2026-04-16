import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useDriverMenu } from '@/lib/driver-menu-context';
import { useState } from 'react';

export default function DriverMenuScreen() {
  const colors = useColors();
  const { state, dispatch } = useDriverMenu();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const menuSections = [
    {
      id: 'work-hub',
      title: '💼 Work Hub',
      description: 'Earnings, status & stats',
      icon: '💼',
      items: [
        { label: 'Today\'s Earnings', value: '$247.50' },
        { label: 'Active Status', value: 'Online' },
        { label: 'Acceptance Rate', value: '98%' },
      ],
    },
    {
      id: 'opportunities',
      title: '⚡ Opportunities',
      description: 'Surge zones & bonuses',
      icon: '⚡',
      items: [
        { label: 'Active Surges', value: '3 zones' },
        { label: 'Peak Hours', value: '5-7 PM' },
        { label: 'Bonus Available', value: '$50' },
      ],
    },
    {
      id: 'pro-status',
      title: '⭐ Pro Status',
      description: 'Professional tier info',
      icon: '⭐',
      items: [
        { label: 'Current Tier', value: 'Standard' },
        { label: 'Rating', value: '4.98' },
        { label: 'Rides', value: '1,247' },
      ],
    },
    {
      id: 'refer-friend',
      title: '👥 Refer Friend',
      description: 'Share & earn rewards',
      icon: '👥',
      items: [
        { label: 'Your Code', value: 'RYDINEX2024' },
        { label: 'Earnings', value: '$450' },
        { label: 'Referrals', value: '12' },
      ],
    },
    {
      id: 'vehicle',
      title: '🚗 Manage Vehicle',
      description: 'Vehicle & inspection',
      icon: '🚗',
      items: [
        { label: 'Registered', value: '1 vehicle' },
        { label: 'Inspection', value: 'Valid' },
        { label: 'Insurance', value: 'Active' },
      ],
    },
    {
      id: 'documents',
      title: '📄 Documents',
      description: 'Upload & track docs',
      icon: '📄',
      items: [
        { label: 'Status', value: 'Approved' },
        { label: 'Expiring Soon', value: '1 doc' },
        { label: 'Last Updated', value: '3 days ago' },
      ],
    },
    {
      id: 'tax',
      title: '📊 Tax Information',
      description: '1099 & tax forms',
      icon: '📊',
      items: [
        { label: 'YTD Earnings', value: '$12,450' },
        { label: '1099 Status', value: 'Ready' },
        { label: 'Tax Year', value: '2026' },
      ],
    },
    {
      id: 'help',
      title: '❓ Help',
      description: 'FAQ & support',
      icon: '❓',
      items: [
        { label: 'FAQs', value: 'Browse' },
        { label: 'Contact Support', value: 'Chat' },
        { label: 'Guides', value: 'View' },
      ],
    },
    {
      id: 'safety',
      title: '🛡️ Safety',
      description: 'Emergency & tips',
      icon: '🛡️',
      items: [
        { label: 'Emergency Contact', value: 'Set' },
        { label: 'Safety Tips', value: 'Read' },
        { label: 'Incident Report', value: 'File' },
      ],
    },
    {
      id: 'settings',
      title: '⚙️ Settings',
      description: 'Preferences & account',
      icon: '⚙️',
      items: [
        { label: 'Notifications', value: 'On' },
        { label: 'Language', value: 'English' },
        { label: 'Account', value: 'Manage' },
      ],
    },
  ];

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Driver Menu</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Manage your Rydinex account</Text>
        </View>

        {/* Menu Sections */}
        <View style={styles.sectionsContainer}>
          {menuSections.map(section => (
            <View key={section.id}>
              <Pressable
                onPress={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                style={({ pressed }) => [
                  styles.sectionButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionLeft}>
                    <Text style={styles.sectionIcon}>{section.icon}</Text>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        {section.title}
                      </Text>
                      <Text style={[styles.sectionDescription, { color: colors.muted }]}>
                        {section.description}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.expandIcon,
                      {
                        color: colors.muted,
                        transform: [{ rotate: expandedSection === section.id ? '180deg' : '0deg' }],
                      },
                    ]}
                  >
                    ▼
                  </Text>
                </View>

                {/* Expanded Content */}
                {expandedSection === section.id && (
                  <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
                    {section.items.map((item, index) => (
                      <View key={index}>
                        <View style={styles.itemRow}>
                          <Text style={[styles.itemLabel, { color: colors.muted }]}>{item.label}</Text>
                          <Text style={[styles.itemValue, { color: colors.foreground }]}>{item.value}</Text>
                        </View>
                        {index < section.items.length - 1 && (
                          <View style={[styles.itemDivider, { backgroundColor: colors.border }]} />
                        )}
                      </View>
                    ))}

                    {/* Action Button */}
                    <Pressable
                      onPress={() => dispatch({ type: 'SET_SECTION', payload: section.id as any })}
                      style={({ pressed }) => [
                        styles.actionButton,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={styles.actionButtonText}>View Details →</Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={[styles.quickActionsTitle, { color: colors.foreground }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <Pressable
              style={({ pressed }) => [
                styles.quickActionButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.quickActionIcon}>📞</Text>
              <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>Support</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.quickActionButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.quickActionIcon}>📱</Text>
              <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>App Info</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.quickActionButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.quickActionIcon}>🔐</Text>
              <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>Privacy</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.quickActionButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.quickActionIcon}>📋</Text>
              <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>Terms</Text>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.muted }]}>Rydinex v5.0</Text>
          <Text style={[styles.footerText, { color: colors.muted }]}>© 2026 Rydinex Technology</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  sectionsContainer: { gap: 12, marginBottom: 32 },
  sectionButton: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sectionLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  sectionIcon: { fontSize: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  sectionDescription: { fontSize: 12 },
  expandIcon: { fontSize: 12, fontWeight: '700' },
  expandedContent: { borderTopWidth: 1, padding: 16, gap: 0 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  itemLabel: { fontSize: 12 },
  itemValue: { fontSize: 12, fontWeight: '600' },
  itemDivider: { height: 1 },
  actionButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  actionButtonText: { fontSize: 13, fontWeight: '600', color: '#00D4AA' },
  quickActionsSection: { marginBottom: 32 },
  quickActionsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActionButton: { flex: 1, minWidth: '45%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  quickActionIcon: { fontSize: 24, marginBottom: 4 },
  quickActionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  footer: { alignItems: 'center', paddingVertical: 24, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  footerText: { fontSize: 11, marginBottom: 2 },
});
