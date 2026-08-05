import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ORDER_THEME } from '@/constants/OrderTheme';

interface Earning {
  id: number;
  date: string;
  orderId: number;
  customer: string;
  fee: number;
  createdAt: string;
}

export default function RunnerEarnings() {
  const router = useRouter();
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEarnings = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;

    const { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', uid).single();
    if (wallet) {
      const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('id, amount, order_id, created_at, orders:order_id ( requester:requester_id ( name ) )')
        .eq('wallet_id', wallet.id)
        .eq('tx_type', 'earn')
        .order('created_at', { ascending: false });

      if (txs) {
        setEarnings(
          (txs as any[]).map((t) => ({
            id: t.id,
            orderId: t.order_id,
            customer: t.orders?.requester?.name || 'ไม่ทราบชื่อ',
            fee: Number(t.amount),
            createdAt: t.created_at,
            date: new Date(t.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
          }))
        );
      }
    }

    const { data: reviews } = await supabase.from('reviews').select('rating_stars').eq('runner_id', uid);
    if (reviews && reviews.length > 0) {
      setAvgRating(reviews.reduce((s, r) => s + r.rating_stars, 0) / reviews.length);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEarnings();
    }, [loadEarnings])
  );

  const now = Date.now();
  const filteredEarnings = earnings.filter((e) => {
    const diffDays = (now - new Date(e.createdAt).getTime()) / 86400000;
    if (filterPeriod === 'today') return diffDays <= 1;
    if (filterPeriod === 'week') return diffDays <= 7;
    return diffDays <= 30;
  });

  const totalEarnings = filteredEarnings.reduce((sum, e) => sum + e.fee, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title="รายได้ของฉัน" />

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIconBox, { backgroundColor: ORDER_THEME.accentSoft }]}>
              <Ionicons name="wallet" size={20} color={ORDER_THEME.accent} />
            </View>
            <Text style={styles.summaryLabel}>รายได้รวม</Text>
            <Text style={styles.summaryValue}>฿{totalEarnings.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIconBox, { backgroundColor: ORDER_THEME.successSoft }]}>
              <Ionicons name="checkmark-circle" size={20} color={ORDER_THEME.success} />
            </View>
            <Text style={styles.summaryLabel}>งานสำเร็จ</Text>
            <Text style={styles.summaryValue}>{filteredEarnings.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIconBox, { backgroundColor: ORDER_THEME.warningSoft }]}>
              <Ionicons name="star" size={20} color={ORDER_THEME.warning} />
            </View>
            <Text style={styles.summaryLabel}>คะแนนดาว</Text>
            <Text style={styles.summaryValue}>{avgRating ? avgRating.toFixed(1) : '5.0'}</Text>
          </View>
        </View>

        {/* Period Filter */}
        <View style={styles.filterSection}>
          {(['today', 'week', 'month'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.filterBtn, filterPeriod === period && styles.filterBtnActive]}
              onPress={() => setFilterPeriod(period)}
            >
              <Text style={[styles.filterBtnText, filterPeriod === period && styles.filterBtnTextActive]}>
                {period === 'today' ? 'วันนี้' : period === 'week' ? '7 วันล่าสุด' : '30 วันล่าสุด'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Earnings List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ประวัติรายรับอย่างละเอียด</Text>
          {loading ? (
            <ActivityIndicator color={ORDER_THEME.accent} style={{ marginTop: 20 }} />
          ) : filteredEarnings.length === 0 ? (
            <Text style={styles.emptyText}>ยังไม่มีรายได้เข้ามาในช่วงเวลานี้</Text>
          ) : (
            filteredEarnings.map((earning) => (
              <View key={earning.id} style={styles.earningCard}>
                <View style={styles.earningHeader}>
                  <View>
                    <Text style={styles.orderNumber}>ออเดอร์ฝากหิ้ว #{earning.orderId}</Text>
                    <Text style={styles.date}>{earning.date} · ผู้ฝาก: {earning.customer}</Text>
                  </View>
                  <Text style={styles.fee}>+฿{earning.fee.toFixed(0)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Withdrawal Section */}
          <View style={styles.withdrawalSection}>
          <View style={styles.withdrawalLeft}>
            <Ionicons name="cash-outline" size={24} color="#FF7A30" />
            <View>
              <Text style={styles.withdrawalTitle}>ยอดเงินสะสมที่พร้อมถอน</Text>
              <Text style={styles.withdrawalAmount}>฿{totalEarnings.toFixed(0)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.withdrawalBtn} onPress={() => router.push({ pathname: '/payment/payment-methods', params: { mode: 'withdraw' } })}>
            <Text style={styles.withdrawalBtnText}>กดถอนเงิน</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ORDER_THEME.backgroundAlt },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 10 },
  summaryCard: {
    flex: 1, backgroundColor: ORDER_THEME.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: ORDER_THEME.borderSoft, gap: 2, shadowColor: '#3A2113', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1
  },
  cardIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: ORDER_THEME.textSecondary, fontWeight: '600' },
  summaryValue: { fontSize: 16, fontWeight: 'bold', color: ORDER_THEME.textPrimary },
  filterSection: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 20, backgroundColor: ORDER_THEME.surface, borderWidth: 1, borderColor: ORDER_THEME.borderSoft },
  filterBtnActive: { backgroundColor: ORDER_THEME.accent, borderColor: ORDER_THEME.accent },
  filterBtnText: { textAlign: 'center', fontSize: 12, fontWeight: '700', color: ORDER_THEME.textSecondary },
  filterBtnTextActive: { color: ORDER_THEME.surface },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: ORDER_THEME.textPrimary, marginBottom: 12 },
  emptyText: { textAlign: 'center', color: ORDER_THEME.textMuted, marginTop: 10, fontSize: 13 },
  earningCard: { backgroundColor: ORDER_THEME.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: ORDER_THEME.borderSoft },
  earningHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 14, fontWeight: 'bold', color: ORDER_THEME.textPrimary },
  date: { fontSize: 12, color: ORDER_THEME.textSecondary, marginTop: 2 },
  fee: { fontSize: 16, fontWeight: 'bold', color: ORDER_THEME.success },
  withdrawalSection: {
    marginHorizontal: 20, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: ORDER_THEME.surface,
    borderRadius: 16, borderWidth: 1.5, borderColor: ORDER_THEME.accent,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: ORDER_THEME.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1
  },
  withdrawalLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  withdrawalTitle: { fontSize: 12, color: ORDER_THEME.textSecondary, fontWeight: '600' },
  withdrawalAmount: { fontSize: 22, fontWeight: 'bold', color: ORDER_THEME.accent, marginTop: 2 },
  withdrawalBtn: { backgroundColor: ORDER_THEME.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  withdrawalBtnText: { color: ORDER_THEME.surface, fontWeight: 'bold', fontSize: 13 },
});