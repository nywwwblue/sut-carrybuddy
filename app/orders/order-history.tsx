import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusPill } from '@/components/StatusPill';
import { EmptyState } from '@/components/EmptyState';
import { ORDER_THEME } from '@/constants/OrderTheme';

interface HistoryOrder {
  id: number;
  route: string;
  otherPartyName: string;
  date: string;
  status: string;
  isFlash: boolean;
  rating: number | null;
}

const AVATAR_COLORS = ['#4A90E2', '#50C878', '#FF7A30', '#9B59B6'];

export default function OrderHistory() {
  const router = useRouter();
  const [filter, setFilter] = useState<'completed' | 'cancelled'>('completed');
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;

    const { data } = await supabase
      .from('orders')
      .select(
        `id, status, created_at,
         requester:requester_id ( id, name ),
         runner:runner_id ( id, name ),
         post:post_id ( post_type, store:store_id ( name ), dropoff:dropoff_id ( name ) ),
         direct_store:store_id ( name ), direct_dropoff:dropoff_id ( name ), custom_dropoff_label,
         reviews ( rating_stars )`
      )
      .or(`requester_id.eq.${uid},runner_id.eq.${uid}`)
      .eq('status', filter)
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(
        (data as any[]).map((row) => {
          const iAmRunner = row.runner?.id === uid;
          const other = iAmRunner ? row.requester : row.runner;

          // ประกาศตัวแปรดึงชื่อร้านค้า (รองรับคำขอปกติและแบบเปิด)
          const storeName = row.post?.store?.name || row.direct_store?.name || 'ระบุพิกัดเอง';

          // ประกาศตัวแปรดึงจุดส่งของ (รองรับทุกสถานการณ์ใน มทส.)
          const dropoffName = row.post?.dropoff?.name || row.direct_dropoff?.name || row.custom_dropoff_label || '-';

          const createdAt = row.created_at ? new Date(row.created_at) : null;
          const safeDate = createdAt && !Number.isNaN(createdAt.getTime())
            ? createdAt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
            : 'ไม่ระบุวันที่';

          return {
            id: row.id,
            route: `${storeName} → ${dropoffName}`,
            otherPartyName: other?.name || 'ไม่ทราบชื่อ',
            date: safeDate,
            status: row.status,
            isFlash: row.post?.post_type === 'flash',
            rating: row.reviews?.[0]?.rating_stars ?? null,
          };
        })
      );
    }
    setLoading(false);
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="ประวัติการฝากหิ้ว" subtitle="งานที่เสร็จแล้วและงานที่ถูกยกเลิก" />

      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'completed' && styles.filterTabActive]}
          onPress={() => setFilter('completed')}
        >
          <Ionicons name="checkmark" size={14} color={filter === 'completed' ? ORDER_THEME.surface : ORDER_THEME.textSecondary} />
          <Text style={[styles.filterTabText, filter === 'completed' && styles.filterTabTextActive]}>งานสำเร็จแล้ว</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'cancelled' && styles.filterTabActive]}
          onPress={() => setFilter('cancelled')}
        >
          <Text style={[styles.filterTabText, filter === 'cancelled' && styles.filterTabTextActive]}>ยกเลิกแล้ว</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#FF7A30" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <EmptyState icon="receipt-outline" title="ไม่มีรายการ" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={styles.orderCard} onPress={() => router.push({ pathname: '/orders/order-detail', params: { orderId: item.id } })}>
              <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                <Text style={styles.avatarText}>{(item.otherPartyName || 'ไม่ทราบ').slice(0, 2)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeText}>{item.route || 'ไม่มีข้อมูลเส้นทาง'}</Text>
                <Text style={styles.subText}>{item.otherPartyName || 'ไม่ทราบชื่อ'} · {item.date}</Text>
                <View style={styles.badgeRow}>
                  <StatusPill status={item.status} size="small" />
                  {item.isFlash && (
                    <View style={styles.flashBadge}>
                      <Ionicons name="flash" size={10} color={ORDER_THEME.accent} />
                      <Text style={styles.flashBadgeText}>Flash Buy</Text>
                    </View>
                  )}
                </View>
              </View>
              {item.rating !== null && (
                <Text style={styles.stars}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</Text>
              )}
              <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ORDER_THEME.backgroundAlt },
  filterTabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 14 },
  filterTab: {
    flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 999, backgroundColor: ORDER_THEME.surface, borderWidth: 1, borderColor: ORDER_THEME.borderSoft,
    shadowColor: '#3A2113', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  filterTabActive: { backgroundColor: ORDER_THEME.accent, borderColor: ORDER_THEME.accent },
  filterTabText: { fontSize: 13, fontWeight: '600', color: ORDER_THEME.textSecondary },
  filterTabTextActive: { color: ORDER_THEME.surface },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  orderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: ORDER_THEME.surface, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: ORDER_THEME.borderSoft,
    shadowColor: '#3A2113', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  routeText: { fontSize: 14, fontWeight: '700', color: ORDER_THEME.textPrimary },
  subText: { fontSize: 12, color: ORDER_THEME.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  flashBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: ORDER_THEME.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  flashBadgeText: { fontSize: 10, color: ORDER_THEME.accent, fontWeight: '700' },
  stars: { fontSize: 12, color: '#FFD700' },
});
