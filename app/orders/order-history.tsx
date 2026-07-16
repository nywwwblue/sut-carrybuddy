import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatusPill } from '@/components/StatusPill';
import { EmptyState } from '@/components/EmptyState';

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

          return {
            id: row.id,
            route: `${storeName} → ${dropoffName}`,
            otherPartyName: other?.name || 'ไม่ทราบชื่อ',
            date: new Date(row.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
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
      <ScreenHeader title="ประวัติการฝากหิ้ว" />

      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'completed' && styles.filterTabActive]}
          onPress={() => setFilter('completed')}
        >
          <Ionicons name="checkmark" size={14} color={filter === 'completed' ? '#FFFFFF' : '#8B7E74'} />
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
                <Text style={styles.avatarText}>{item.otherPartyName.slice(0, 2)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeText}>{item.route}</Text>
                <Text style={styles.subText}>{item.otherPartyName} · {item.date}</Text>
                <View style={styles.badgeRow}>
                  <StatusPill status={item.status} size="small" />
                  {item.isFlash && (
                    <View style={styles.flashBadge}>
                      <Ionicons name="flash" size={10} color="#FF7A30" />
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
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#3A2113' },
  filterTabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  filterTab: {
    flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8D5C4',
  },
  filterTabActive: { backgroundColor: '#FF7A30', borderColor: '#FF7A30' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#8B7E74' },
  filterTabTextActive: { color: '#FFFFFF' },
  emptyText: { textAlign: 'center', color: '#8B7E74', marginTop: 40 },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  orderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E8D5C4',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  routeText: { fontSize: 14, fontWeight: 'bold', color: '#3A2113' },
  subText: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeSuccess: { backgroundColor: '#E6F7ED' },
  badgeCancelled: { backgroundColor: '#FDECEC' },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  badgeTextSuccess: { color: '#2ECC71' },
  badgeTextCancelled: { color: '#E74C3C' },
  flashBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF3E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  flashBadgeText: { fontSize: 10, color: '#FF7A30', fontWeight: 'bold' },
  stars: { fontSize: 12, color: '#FFD700' },
});
