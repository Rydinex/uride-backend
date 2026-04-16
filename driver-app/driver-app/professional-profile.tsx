import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useProfessionalDriver } from '@/lib/professional-driver-context';
import { useState, useEffect } from 'react';

export default function ProfessionalProfileScreen() {
  const colors = useColors();
  const { state } = useProfessionalDriver();
  const [activeTab, setActiveTab] = useState<'profile' | 'vehicles' | 'documents' | 'compliance'>('profile');

  // Mock professional driver data
  const mockDriver = {
    firstName: 'James',
    lastName: 'Anderson',
    email: 'james.anderson@email.com',
    phone: '+1 (312) 555-0147',
    state: 'Illinois',
    city: 'Chicago',
    rating: 4.98,
    totalRides: 1247,
    joinedAt: '2023-06-15',
    profilePicture: '👨‍💼',
    verifiedBadge: true,
    overallStatus: 'approved' as const,
  };

  const mockVehicles = [
    {
      id: '1',
      type: 'black-car',
      make: 'Mercedes-Benz',
      model: 'S-Class',
      year: 2023,
      color: 'Black',
      licensePlate: 'RYD-BLK-001',
      status: 'approved' as const,
    },
    {
      id: '2',
      type: 'black-suv',
      make: 'BMW',
      model: 'X7',
      year: 2022,
      color: 'Black',
      licensePlate: 'RYD-SUV-002',
      status: 'approved' as const,
    },
  ];

  const mockDocuments = [
    { type: 'Chauffeur License', status: 'approved', expiresAt: '2026-12-31' },
    { type: 'Driver License', status: 'approved', expiresAt: '2027-06-15' },
    { type: 'Livery Card', status: 'approved', expiresAt: '2025-12-31' },
    { type: 'Background Check', status: 'approved', expiresAt: '2024-12-31' },
    { type: 'Commercial Insurance', status: 'approved', expiresAt: '2024-08-31' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#00D4AA';
      case 'pending':
        return '#FFCC00';
      case 'rejected':
        return '#FF4444';
      default:
        return colors.muted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '✓ Approved';
      case 'pending':
        return '⏳ Pending';
      case 'rejected':
        return '✗ Rejected';
      default:
        return status;
    }
  };

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Professional Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.profileTop}>
            <Text style={styles.profilePicture}>{mockDriver.profilePicture}</Text>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>
                  {mockDriver.firstName} {mockDriver.lastName}
                </Text>
                {mockDriver.verifiedBadge && <Text style={styles.badge}>✓ Verified</Text>}
              </View>
              <Text style={[styles.profileLocation, { color: colors.muted }]}>
                {mockDriver.city}, {mockDriver.state}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{mockDriver.rating}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Rating</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{mockDriver.totalRides}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Rides</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {mockDriver.overallStatus === 'approved' ? '✓' : '⏳'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Status</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(['profile', 'vehicles', 'documents', 'compliance'] as const).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                {
                  borderBottomColor: activeTab === tab ? '#00D4AA' : 'transparent',
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === tab ? '#00D4AA' : colors.muted,
                    fontWeight: activeTab === tab ? '700' : '500',
                  },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'profile' && (
          <View style={styles.tabContent}>
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Email</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{mockDriver.email}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Phone</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{mockDriver.phone}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.muted }]}>Member Since</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {new Date(mockDriver.joinedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'vehicles' && (
          <View style={styles.tabContent}>
            {mockVehicles.map(vehicle => (
              <View
                key={vehicle.id}
                style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.vehicleTop}>
                  <View>
                    <Text style={[styles.vehicleTitle, { color: colors.foreground }]}>
                      {vehicle.make} {vehicle.model}
                    </Text>
                    <Text style={[styles.vehicleSubtitle, { color: colors.muted }]}>
                      {vehicle.year} · {vehicle.color}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(vehicle.status) }]}>
                    <Text style={styles.statusBadgeText}>{getStatusText(vehicle.status)}</Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.vehicleDetails}>
                  <View style={styles.vehicleDetail}>
                    <Text style={[styles.vehicleDetailLabel, { color: colors.muted }]}>License Plate</Text>
                    <Text style={[styles.vehicleDetailValue, { color: colors.foreground }]}>
                      {vehicle.licensePlate}
                    </Text>
                  </View>
                  <View style={styles.vehicleDetail}>
                    <Text style={[styles.vehicleDetailLabel, { color: colors.muted }]}>Type</Text>
                    <Text style={[styles.vehicleDetailValue, { color: colors.foreground }]}>
                      {vehicle.type === 'black-car' ? 'Black Car' : 'Black SUV'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'documents' && (
          <View style={styles.tabContent}>
            {mockDocuments.map((doc, index) => (
              <View
                key={index}
                style={[styles.documentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.documentRow}>
                  <View style={styles.documentLeft}>
                    <Text style={styles.documentIcon}>📄</Text>
                    <View>
                      <Text style={[styles.documentTitle, { color: colors.foreground }]}>{doc.type}</Text>
                      <Text style={[styles.documentExpiry, { color: colors.muted }]}>
                        Expires: {new Date(doc.expiresAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(doc.status) }]}>
                    <Text style={styles.statusBadgeText}>{getStatusText(doc.status)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'compliance' && (
          <View style={styles.tabContent}>
            <View style={[styles.complianceCard, { backgroundColor: 'rgba(0,212,170,0.08)', borderColor: '#00D4AA' }]}>
              <Text style={[styles.complianceTitle, { color: colors.foreground }]}>✓ Fully Compliant</Text>
              <Text style={[styles.complianceText, { color: colors.muted }]}>
                All requirements met. You're approved to drive Rydinex Black.
              </Text>
            </View>

            <View style={[styles.checklistCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.checklistItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={[styles.checklistText, { color: colors.foreground }]}>Age requirement met</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.checklistItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={[styles.checklistText, { color: colors.foreground }]}>Driving experience verified</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.checklistItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={[styles.checklistText, { color: colors.foreground }]}>All documents approved</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.checklistItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={[styles.checklistText, { color: colors.foreground }]}>Background check passed</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.checklistItem}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={[styles.checklistText, { color: colors.foreground }]}>Vehicles verified</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800' },
  profileCard: { borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1 },
  profileTop: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  profilePicture: { fontSize: 48 },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileName: { fontSize: 18, fontWeight: '700' },
  badge: { backgroundColor: '#00D4AA', color: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 11, fontWeight: '600' },
  profileLocation: { fontSize: 13 },
  divider: { height: 1, marginVertical: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 30 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 13 },
  tabContent: { marginBottom: 24 },
  infoCard: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  vehicleCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  vehicleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  vehicleTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  vehicleSubtitle: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  vehicleDetails: { flexDirection: 'row', gap: 16 },
  vehicleDetail: { flex: 1 },
  vehicleDetailLabel: { fontSize: 11, marginBottom: 2 },
  vehicleDetailValue: { fontSize: 13, fontWeight: '600' },
  documentCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  documentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  documentLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  documentIcon: { fontSize: 24 },
  documentTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  documentExpiry: { fontSize: 12 },
  complianceCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  complianceTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  complianceText: { fontSize: 13, lineHeight: 18 },
  checklistCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  checklistItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  checkmark: { fontSize: 20, color: '#00D4AA', fontWeight: '700' },
  checklistText: { fontSize: 14 },
});
