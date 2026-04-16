import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAppContext } from '@/lib/app-context';
import { useState } from 'react';

const WEEKLY_DATA = [
  { day: 'Mon', earnings: 142.50, trips: 12 },
  { day: 'Tue', earnings: 98.75, trips: 8 },
  { day: 'Wed', earnings: 175.20, trips: 15 },
  { day: 'Thu', earnings: 120.00, trips: 10 },
  { day: 'Fri', earnings: 210.80, trips: 18 },
  { day: 'Sat', earnings: 95.95, trips: 8 },
  { day: 'Sun', earnings: 0, trips: 0 },
];

const maxEarnings = Math.max(...WEEKLY_DATA.map(d => d.earnings));

export default function EarningsScreen() {
  const colors = useColors();
  const { state } = useAppContext();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');

  const totalWeek = WEEKLY_DATA.reduce((sum, d) => sum + d.earnings, 0);
  const totalTrips = WEEKLY_DATA.reduce((sum, d) => sum + d.trips, 0);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}