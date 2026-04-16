import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { PAYMENT_METHODS } from '@/lib/mock-data';
import { useAppContext } from '@/lib/app-context';

const PROMO_CODES = [
  { code: 'WAVE10', discount: '10% off next ride', expires: 'Apr 15' },
  { code: 'NEWUSER', discount: '$5 off first 3 rides', expires: 'May 1' },
];

export default function WalletScreen() {
  const colors = useColors();
  const { state } = useAppContext();

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Wallet</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardBg} />
          <Text style={styles.balanceLabel}>Rydinex Wallet</Text>
          <Text style={styles.balanceAmount}>${state.walletBalance.toFixed(2)}</Text>
          <View style={styles.balanceActions}>
            <Pressable style={({ pressed }) => [styles.balanceBtn, pressed && { opacity: 0.8 }]}>
              <Text style={styles.balanceBtnIcon}>+</Text>
              <Text style={styles.balanceBtnText}>Add Funds</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.balanceBtn, pressed && { opacity: 0.8 }]}>
              <Text style={styles.balanceBtnIcon}>↑</Text>
              <Text style={styles.balanceBtnText}>Transfer</Text>
            </Pressable>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment Methods</Text>
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.addBtnText, { color: '#00D4AA' }]}>+ Add</Text>
            </Pressable>
          </View>

          {PAYMENT_METHODS.map(pm => (
            <Pressable
              key={pm.id}
              style={({ pressed }) => [
                styles.paymentCard,
                { borderColor: pm.isDefault ? '#00D4AA' : colors.border },
                pm.isDefault && { backgroundColor: 'rgba(0,212,170,0.05)' },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.paymentIcon, { backgroundColor: pm.type === 'wallet' ? 'rgba(0,212,170,0.15)' : '#F8F9FA' }]}>
                <Text style={styles.paymentIconText}>
                  {pm.type === 'visa' ? '💳' : pm.type === 'mastercard' ? '💳' : '👛'}
                </Text>
              </View>
              <View style={styles.paymentInfo}>
                <Text style={[styles.paymentLabel, { color: colors.foreground }]}>{pm.label}</Text>
                {pm.type === 'wallet' && (
                  <Text style={[styles.paymentBalance, { color: '#00D4AA' }]}>${state.walletBalance.toFixed(2)} available</Text>
                )}
              </View>
              {pm.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              )}
              {!pm.isDefault && (
                <Text style={[styles.setDefaultText, { color: colors.muted }]}>Set default</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Promo Codes */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Promo Codes</Text>
            <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.addBtnText, { color: '#00D4AA' }]}>Enter Code</Text>
            </Pressable>
          </View>

          {PROMO_CODES.map(promo => (
            <View key={promo.code} style={[styles.promoCard, { borderColor: colors.border }]}>
              <View style={[styles.promoIcon, { backgroundColor: 'rgba(255,107,53,0.1)' }]}>
                <Text style={styles.promoIconText}>🏷️</Text>
              </View>
              <View style={styles.promoInfo}>
                <Text style={[styles.promoCode, { color: colors.foreground }]}>{promo.code}</Text>
                <Text style={[styles.promoDiscount, { color: colors.muted }]}>{promo.discount}</Text>
              </View>
              <Text style={[styles.promoExpiry, { color: colors.muted }]}>Exp {promo.expires}</Text>
            </View>
          ))}
        </View>

        {/* Transaction History */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Transactions</Text>
          {[
            { label: 'Ride to Downtown SF', amount: -12.50, date: 'Today' },
            { label: 'Wallet top-up', amount: +25.00, date: 'Yesterday' },
            { label: 'Ride to SFO Airport', amount: -38.75, date: 'Mar 24' },
            { label: 'Promo credit applied', amount: +5.00, date: 'Mar 23' },
          ].map((tx, i) => (
            <View key={i} style={[styles.txRow, { borderBottomColor: colors.border }]}>
              <View style={styles.txInfo}>
                <Text style={[styles.txLabel, { color: colors.foreground }]}>{tx.label}</Text>
                <Text style={[styles.txDate, { color: colors.muted }]}>{tx.date}</Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#00C851' : colors.foreground }]}>
                {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 0.5 },
  title: { fontSize: 28, fontWeight: '800' },
  content: { padding: 16, gap: 16 },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#1A1A2E',
    overflow: 'hidden',
    gap: 8,
  },
  balanceCardBg: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,212,170,0.08)',
    top: -60,
    right: -40,
  },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  balanceAmount: { fontSize: 44, fontWeight: '800', color: '#00D4AA' },
  balanceActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  balanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  balanceBtnIcon: { fontSize: 18, color: 'white', fontWeight: '700' },
  balanceBtnText: { fontSize: 14, color: 'white', fontWeight: '600' },
  section: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  addBtn: { padding: 4 },
  addBtnText: { fontSize: 14, fontWeight: '600' },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  paymentIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  paymentIconText: { fontSize: 20 },
  paymentInfo: { flex: 1 },
  paymentLabel: { fontSize: 15, fontWeight: '600' },
  paymentBalance: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  defaultBadge: { backgroundColor: 'rgba(0,212,170,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  defaultBadgeText: { fontSize: 12, color: '#00D4AA', fontWeight: '700' },
  setDefaultText: { fontSize: 12 },
  promoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5 },
  promoIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  promoIconText: { fontSize: 18 },
  promoInfo: { flex: 1 },
  promoCode: { fontSize: 15, fontWeight: '700' },
  promoDiscount: { fontSize: 13, marginTop: 2 },
  promoExpiry: { fontSize: 12 },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5 },
  txInfo: { gap: 2 },
  txLabel: { fontSize: 14, fontWeight: '500' },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 16, fontWeight: '700' },
});
