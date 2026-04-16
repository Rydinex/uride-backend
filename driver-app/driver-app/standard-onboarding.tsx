import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useStandardDriver } from '@/lib/standard-driver-context';
import { TIER_PRICING, getAvailableTiers, STANDARD_DRIVER_REQUIREMENTS } from '@/lib/standard-driver-service';
import { useState } from 'react';

export default function StandardOnboardingScreen() {
  const colors = useColors();
  const { dispatch } = useStandardDriver();

  const [step, setStep] = useState<'type' | 'tier' | 'requirements' | 'documents'>('type');
  const [driverType, setDriverType] = useState<'standard' | 'professional'>('standard');
  const [selectedTier, setSelectedTier] = useState<'rydinex' | 'comfort' | 'xl'>('rydinex');

  const handleContinue = () => {
    if (step === 'type') {
      if (driverType === 'professional') {
        Alert.alert('Professional Driver', 'Navigate to professional driver onboarding');
        return;
      }
      setStep('tier');
    } else if (step === 'tier') {
      setStep('requirements');
    } else if (step === 'requirements') {
      setStep('documents');
    } else if (step === 'documents') {
      Alert.alert('Success', 'Ready to upload documents');
    }
  };

  const tiers = getAvailableTiers();

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: colors.border,
                width: `${((['type', 'tier', 'requirements', 'documents'].indexOf(step) + 1) / 4) * 100}%`,
              },
            ]}
          />
        </View>

        {/* Step 1: Driver Type */}
        {step === 'type' && (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.foreground }]}>Become a Rydinex Driver</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Choose your driver type to get started
            </Text>

            <View style={styles.optionsContainer}>
              <Pressable
                onPress={() => setDriverType('standard')}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: colors.surface,
                    borderColor: driverType === 'standard' ? '#00D4AA' : colors.border,
                    borderWidth: driverType === 'standard' ? 2 : 1,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.optionIcon, { fontSize: 32 }]}>🚗</Text>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Standard Driver</Text>
                <Text style={[styles.optionDescription, { color: colors.muted }]}>
                  Drive your own car with flexible hours
                </Text>
                <View style={styles.features}>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Three service tiers</Text>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Flexible schedule</Text>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ 70% earnings</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setDriverType('professional')}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: colors.surface,
                    borderColor: driverType === 'professional' ? '#00D4AA' : colors.border,
                    borderWidth: driverType === 'professional' ? 2 : 1,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.optionIcon, { fontSize: 32 }]}>🚙</Text>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Professional Driver</Text>
                <Text style={[styles.optionDescription, { color: colors.muted }]}>
                  Premium service with luxury vehicles
                </Text>
                <View style={styles.features}>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Rydinex Black only</Text>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Higher earnings</Text>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Verified badge</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* Step 2: Tier Selection */}
        {step === 'tier' && (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.foreground }]}>Choose Your Service Tier</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Select which tier(s) you want to drive
            </Text>

            <View style={styles.tiersContainer}>
              {tiers.map(tier => {
                const pricing = TIER_PRICING[tier];
                return (
                  <Pressable
                    key={tier}
                    onPress={() => setSelectedTier(tier)}
                    style={({ pressed }) => [
                      styles.tierCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: selectedTier === tier ? '#00D4AA' : colors.border,
                        borderWidth: selectedTier === tier ? 2 : 1,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={styles.tierHeader}>
                      <Text style={styles.tierEmoji}>{pricing.emoji}</Text>
                      <View style={styles.tierInfo}>
                        <Text style={[styles.tierName, { color: colors.foreground }]}>{pricing.displayName}</Text>
                        <Text style={[styles.tierDescription, { color: colors.muted }]}>
                          {pricing.description}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.tierPricing}>
                      <View style={styles.pricingRow}>
                        <Text style={[styles.pricingLabel, { color: colors.muted }]}>Base Fare</Text>
                        <Text style={[styles.pricingValue, { color: colors.foreground }]}>
                          ${pricing.baseFare.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.pricingRow}>
                        <Text style={[styles.pricingLabel, { color: colors.muted }]}>Per Mile</Text>
                        <Text style={[styles.pricingValue, { color: colors.foreground }]}>
                          ${pricing.perMileFare.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.pricingRow}>
                        <Text style={[styles.pricingLabel, { color: colors.muted }]}>Min Fare</Text>
                        <Text style={[styles.pricingValue, { color: colors.foreground }]}>
                          ${pricing.minFare.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.tierFeatures}>
                      <Text style={[styles.featureText, { color: colors.muted }]}>
                        Up to {pricing.maxPassengers} passengers
                      </Text>
                      <Text style={[styles.featureText, { color: colors.muted }]}>
                        {pricing.vehicleTypes.join(', ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 3: Requirements */}
        {step === 'requirements' && (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.foreground }]}>Standard Driver Requirements</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Make sure you meet all requirements before proceeding
            </Text>

            <View style={[styles.requirementCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Age Requirement</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    Must be at least {STANDARD_DRIVER_REQUIREMENTS.minAge} years old
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Driving Experience</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    {STANDARD_DRIVER_REQUIREMENTS.minDrivingYearsRequired}+ years of driving experience
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Vehicle Year</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    {STANDARD_DRIVER_REQUIREMENTS.minVehicleYear}-{STANDARD_DRIVER_REQUIREMENTS.maxVehicleYear}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Documents Required</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    {STANDARD_DRIVER_REQUIREMENTS.requiredDocuments.length} documents needed
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Background Check</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>Required</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Drug Test</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>Required</Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: 'rgba(0,212,170,0.08)', borderColor: '#00D4AA' }]}>
              <Text style={[styles.infoText, { color: colors.muted }]}>
                You'll earn 70% of the fare after credit card fees (2.9% + $0.30) and city fees (5%).
              </Text>
            </View>
          </View>
        )}

        {/* Step 4: Documents */}
        {step === 'documents' && (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.foreground }]}>Upload Documents</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Complete your application by uploading required documents
            </Text>

            <View style={[styles.documentsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {STANDARD_DRIVER_REQUIREMENTS.requiredDocuments.map((doc, index) => (
                <View key={index}>
                  <View style={styles.documentItem}>
                    <Text style={[styles.documentIcon, { color: '#00D4AA' }]}>📄</Text>
                    <View style={styles.documentInfo}>
                      <Text style={[styles.documentName, { color: colors.foreground }]}>
                        {doc.replace('-', ' ').toUpperCase()}
                      </Text>
                      <Text style={[styles.documentStatus, { color: colors.muted }]}>Not uploaded</Text>
                    </View>
                    <Text style={[styles.documentArrow, { color: colors.muted }]}>›</Text>
                  </View>
                  {index < STANDARD_DRIVER_REQUIREMENTS.requiredDocuments.length - 1 && (
                    <View style={[styles.documentDivider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          {step !== 'type' && (
            <Pressable
              onPress={() => {
                if (step === 'tier') setStep('type');
                else if (step === 'requirements') setStep('tier');
                else if (step === 'documents') setStep('requirements');
              }}
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>Back</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.button,
              styles.primaryButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {step === 'documents' ? 'Upload Documents' : 'Continue'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  progressContainer: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginBottom: 24, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 2 },
  stepContainer: { paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  optionsContainer: { gap: 16, marginBottom: 24 },
  option: { borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1 },
  optionIcon: { marginBottom: 12 },
  optionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  optionDescription: { fontSize: 13, marginBottom: 12, textAlign: 'center' },
  features: { gap: 6, width: '100%' },
  feature: { fontSize: 12, textAlign: 'center' },
  tiersContainer: { gap: 16, marginBottom: 24 },
  tierCard: { borderRadius: 12, padding: 16, borderWidth: 1 },
  tierHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tierEmoji: { fontSize: 32 },
  tierInfo: { flex: 1 },
  tierName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  tierDescription: { fontSize: 12 },
  divider: { height: 1, marginVertical: 12 },
  tierPricing: { gap: 8, marginBottom: 12 },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pricingLabel: { fontSize: 12 },
  pricingValue: { fontSize: 13, fontWeight: '600' },
  tierFeatures: { gap: 4 },
  featureText: { fontSize: 12 },
  requirementCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  requirementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  requirementIcon: { fontSize: 20, marginTop: 2 },
  requirementContent: { flex: 1 },
  requirementTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  requirementText: { fontSize: 12 },
  infoBox: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 24 },
  infoText: { fontSize: 13, lineHeight: 18 },
  documentsList: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  documentItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  documentIcon: { fontSize: 20 },
  documentInfo: { flex: 1 },
  documentName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  documentStatus: { fontSize: 12 },
  documentArrow: { fontSize: 20 },
  documentDivider: { height: 1 },
  buttonContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: '#00D4AA' },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  secondaryButton: { borderWidth: 1 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
