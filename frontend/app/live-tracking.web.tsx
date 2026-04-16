import { View, Text, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

export default function LiveTrackingScreenWeb() {
  const colors = useColors();

  return (
    <ScreenContainer className="flex-1 items-center justify-center gap-4">
      <Text style={[styles.emoji]}>🗺️</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Live Tracking
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Available on iOS and Android
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emoji: {
    fontSize: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
  },
});
