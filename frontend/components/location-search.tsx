import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useLocationTracking } from '@/lib/location-tracking-context';

interface SearchResult {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'recent' | 'search' | 'saved';
}

export default function LocationSearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch } = useLocationTracking();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Mock search results
  const mockSearchResults: SearchResult[] = [
    {
      id: '1',
      address: 'San Francisco International Airport (SFO)',
      latitude: 37.6213,
      longitude: -122.379,
      type: 'search',
    },
    {
      id: '2',
      address: 'Ferry Building, San Francisco',
      latitude: 37.7852,
      longitude: -122.3947,
      type: 'search',
    },
    {
      id: '3',
      address: 'Golden Gate Bridge, San Francisco',
      latitude: 37.8199,
      longitude: -122.4783,
      type: 'search',
    },
    {
      id: '4',
      address: 'Transamerica Pyramid, San Francisco',
      latitude: 37.7952,
      longitude: -122.4028,
      type: 'search',
    },
  ];

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.length > 0) {
      const filtered = mockSearchResults.filter(result =>
        result.address.toLowerCase().includes(text.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectLocation = (result: SearchResult) => {
    const pin = {
      id: result.id,
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
      type: state.selectedPinType || 'pickup' as const,
      timestamp: Date.now(),
    };

    if (state.selectedPinType === 'pickup') {
      dispatch({ type: 'SET_RIDER_PICKUP_PIN', payload: pin });
    } else if (state.selectedPinType === 'dropoff') {
      dispatch({ type: 'SET_RIDER_DROPOFF_PIN', payload: pin });
    }

    dispatch({ type: 'ADD_TO_LOCATION_HISTORY', payload: pin });
    router.back();
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <Pressable
      onPress={() => handleSelectLocation(item)}
      style={({ pressed }) => [
        styles.resultItem,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.resultIcon}>
        <Text style={styles.icon}>📍</Text>
      </View>
      <View style={styles.resultContent}>
        <Text style={[styles.resultAddress, { color: colors.foreground }]} numberOfLines={1}>
          {item.address}
        </Text>
        <Text style={[styles.resultType, { color: colors.muted }]}>
          {item.type === 'recent' ? 'Recent' : 'Popular'}
        </Text>
      </View>
      <Text style={[styles.resultDistance, { color: colors.muted }]}>
        {Math.random().toFixed(1)} mi
      </Text>
    </Pressable>
  );

  return (
    <ScreenContainer containerClassName={`bg-background`}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {state.selectedPinType === 'pickup' ? 'Pickup Location' : 'Dropoff Location'}
        </Text>
      </View>

      {/* Search Input */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search address or place..."
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Search Results */}
      {searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.resultsList}
        />
      ) : searchQuery.length === 0 ? (
        // Show recent locations
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Search for a location
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Enter an address or place name to get started
          </Text>

          {/* Quick Options */}
          <View style={styles.quickOptions}>
            <Pressable
              onPress={() => {
                const pin = {
                  id: 'current',
                  latitude: 37.7749,
                  longitude: -122.4194,
                  address: 'Current Location',
                  type: state.selectedPinType || 'pickup' as const,
                  timestamp: Date.now(),
                };
                if (state.selectedPinType === 'pickup') {
                  dispatch({ type: 'SET_RIDER_PICKUP_PIN', payload: pin });
                } else {
                  dispatch({ type: 'SET_RIDER_DROPOFF_PIN', payload: pin });
                }
                router.back();
              }}
              style={({ pressed }) => [
                styles.quickOption,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={styles.quickOptionIcon}>📍</Text>
              <Text style={styles.quickOptionText}>Use Current Location</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Try searching for a different location
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backIcon: { fontSize: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 48,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  clearIcon: { fontSize: 18, marginLeft: 8 },
  resultsList: { gap: 8 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  resultIcon: { marginRight: 12 },
  icon: { fontSize: 20 },
  resultContent: { flex: 1 },
  resultAddress: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  resultType: { fontSize: 12 },
  resultDistance: { fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 24 },
  quickOptions: { width: '100%', gap: 8 },
  quickOption: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  quickOptionIcon: { fontSize: 18 },
  quickOptionText: { fontSize: 14, fontWeight: '600', color: 'white' },
});
