import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useProfessionalDriver } from '@/lib/professional-driver-context';
import { getAvailableStates, getCitiesByState, getRegulations } from '@/lib/professional-driver-service';
import { useState } from 'react';
// import { useRouter } from 'expo-router';

export default function ProfessionalOnboardingScreen() {
  const colors = useColors();
  // const router = useRouter();
  const { dispatch } = useProfessionalDriver();
  
  const [step, setStep] = useState<'type' | 'location' | 'requirements' | 'documents'>('type');
  const [driverType, setDriverType] = useState<'professional' | 'standard'>('professional');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [cities, setCities] = useState<string[]>([]);

  const availableStates = getAvailableStates();

  const handleStateSelect = (state: string) => {
    setSelectedState(state);
    const citiesInState = getCitiesByState(state);
    setCities(citiesInState);
    setSelectedCity('');
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
  };

  const handleContinue = () => {
    if (step === 'type') {
      setStep('location');
    } else if (step === 'location') {
      if (!selectedState || !selectedCity) {
        Alert.alert('Error', 'Please select both state and city');
        return;
      }
      setStep('requirements');
    } else if (step === 'requirements') {
      setStep('documents');
    } else if (step === 'documents') {
      // Navigate to document upload
      // Navigate to document upload
      Alert.alert('Success', 'Ready to upload documents. This will be implemented in the next step.');
    }
  };

  const regulations = selectedState && selectedCity ? getRegulations(selectedState, selectedCity) : null;

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
                width: `${((['type', 'location', 'requirements', 'documents'].indexOf(step) + 1) / 4) * 100}%`,
              },
            ]}
          />
        </View>

        {/* Step 1: Driver Type */}
        {step === 'type' && (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.foreground }]}>Become a Rydinex Black Driver</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Join our premium driver network and earn more with Rydinex Black
            </Text>

            <View style={styles.optionsContainer}>
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
                <Text style={[styles.optionIcon, { fontSize: 32 }]}>🚗</Text>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Rydinex Black</Text>
                <Text style={[styles.optionDescription, { color: colors.muted }]}>
                  Premium service with higher earnings
                </Text>
                <View style={styles.features}>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Higher base fares</Text>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Professional badge</Text>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Surge pricing</Text>
                </View>
              </Pressable>

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
                <Text style={[styles.optionIcon, { fontSize: 32 }]}>🚙</Text>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Standard Rydinex</Text>
                <Text style={[styles.optionDescription, { color: colors.muted }]}>
                  Regular rideshare service
                </Text>
                <View style={styles.features}>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Flexible schedule</Text>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Any vehicle</Text>
                  <Text style={[styles.feature, { color: colors.muted }]}>✓ Quick signup</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* Step 2: Location */}
        {step === 'location' && (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.foreground }]}>Select Your Service Area</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Choose the state and city where you'll drive
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>State</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateScroll}>
              {availableStates.map(state => (
                <Pressable
                  key={state}
                  onPress={() => handleStateSelect(state)}
                  style={({ pressed }) => [
                    styles.stateButton,
                    {
                      backgroundColor: selectedState === state ? '#00D4AA' : colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stateButtonText,
                      { color: selectedState === state ? '#FFFFFF' : colors.foreground },
                    ]}
                  >
                    {state}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {cities.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>City</Text>
                <View style={styles.citiesGrid}>
                  {cities.map(city => (
                    <Pressable
                      key={city}
                      onPress={() => handleCitySelect(city)}
                      style={({ pressed }) => [
                        styles.cityButton,
                        {
                          backgroundColor: selectedCity === city ? '#00D4AA' : colors.surface,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cityButtonText,
                          { color: selectedCity === city ? '#FFFFFF' : colors.foreground },
                        ]}
                      >
                        {city}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Step 3: Requirements */}
        {step === 'requirements' && regulations && (
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.foreground }]}>Requirements for {regulations.city}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Make sure you meet all requirements before proceeding
            </Text>

            <View style={[styles.requirementCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Age Requirement</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    Must be at least {regulations.minAge} years old
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Driving Experience</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    {regulations.minDrivingYearsRequired}+ years of driving experience
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Vehicle Year</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    {regulations.minVehicleYear}-{regulations.maxVehicleYear}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Documents Required</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    {regulations.requiredDocuments.length} documents needed
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.requirementRow}>
                <Text style={[styles.requirementIcon, { color: '#00D4AA' }]}>✓</Text>
                <View style={styles.requirementContent}>
                  <Text style={[styles.requirementTitle, { color: colors.foreground }]}>Background Check</Text>
                  <Text style={[styles.requirementText, { color: colors.muted }]}>
                    {regulations.backgroundCheckRequired ? 'Required' : 'Not required'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: 'rgba(0,212,170,0.08)', borderColor: '#00D4AA' }]}>
              <Text style={[styles.infoText, { color: colors.muted }]}>
                {regulations.tnpRules}
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

            {regulations && (
              <View style={[styles.documentsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {regulations.requiredDocuments.map((doc, index) => (
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
                    {index < regulations.requiredDocuments.length - 1 && (
                      <View style={[styles.documentDivider, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          {step !== 'type' && (
            <Pressable
              onPress={() => {
                if (step === 'location') setStep('type');
                else if (step === 'requirements') setStep('location');
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
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  stateScroll: { marginBottom: 24 },
  stateButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginRight: 8, borderWidth: 1 },
  stateButtonText: { fontSize: 13, fontWeight: '600' },
  citiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  cityButton: { flex: 1, minWidth: '45%', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  cityButtonText: { fontSize: 13, fontWeight: '600' },
  requirementCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  requirementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  requirementIcon: { fontSize: 20, marginTop: 2 },
  requirementContent: { flex: 1 },
  requirementTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  requirementText: { fontSize: 12 },
  divider: { height: 1, marginVertical: 12 },
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
