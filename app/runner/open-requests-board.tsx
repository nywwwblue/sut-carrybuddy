import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { ORDER_THEME } from '@/constants/OrderTheme';

interface OpenRequest {
  id: number;
  requesterName: string;
  trustScore: number;
  storeName: string;
  dropoffName: string;
  itemSummary: string;
  fee: number;
  itemTotal: number;
}

export default function OpenRequestsBoard() {
  const router = useRouter();
  const [requests, setRequests] = useState<OpenRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select(
        `id, fee, item_total, custom_dropoff_label,
         requester:requester_id ( name, trust_scores ( trust_score ) ),
         store:store_id ( name ),
         dropoff:dropoff_id ( name ),
         order_items ( item_name )`
      )
      .is('runner_id', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) {
      setRequests(
        (data as any[]).map((row) => ({
          id: row.id,
          requesterName: row.requester?.name || 'ไม่ทราบชื่อ',
          trustScore: row.requester?.trust_scores?.[0]?.trust_score ?? 100,
          storeName: row.store?.name || 'ไม่ระบุร้าน',
          dropoffName: row.dropoff?.name || row.custom_dropoff_label || 'ไม่ระบุปลายทาง',
          itemSummary: row.order_items?.length
            ? `${row.order_items[0].item_name}${row.order_items.length > 1 ? ` +${row.order_items.length - 1} รายการ` : ''}`
            : 'ไม่มีรายการ',
          fee: Number(row.fee),
          itemTotal: Number(row.item_total),
        }))
      );
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const handleClaim = async (orderId: number) => {
    if (claimingId !== null) return;
    setClaimingId(orderId);
    const { data, error } = await supabase.rpc('claim_open_order', { p_order_id: orderId });
    setClaimingId(null);

    if (error) {
      Alert.alert('รับงานไม่สำเร็จ', error.message);
      return;
    }
    if (!data) {
      Alert.alert('ช้าไปนิดนึง', 'มีคนอื่นรับงานนี้ไปก่อนแล้ว');
      loadRequests();
      return;
    }
    Alert.alert('รับงานสำเร็จ!', 'ไปที่หน้ารายละเอียดออเดอร์เพื่อเริ่มงานได้เลย', [
      { text: 'ไปดูออเดอร์', onPress: () => router.push({ pathname: '/orders/order-detail', params: { orderId } }) },
    ]);
    loadRequests();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="บอร์ดคำขอเปิด" subtitle="คำขอฝากหิ้วที่ยังไม่มีใครรับ" />

      {loading ? (
        <ActivityIndicator color={ORDER_THEME.accent} style={{ marginTop: 40 }} />
      ) : requests.length === 0 ? (
        <EmptyState icon="megaphone-outline" title="ยังไม่มีคำขอเปิดตอนนี้" />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.requesterName.slice(0, 2)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requesterName}>{item.requesterName}</Text>
                  <TrustScoreBadge score={item.trustScore} size="small" />
                </View>
                <Text style={styles.fee}>ค่าหิ้ว ฿{item.fee}</Text>
              </View>

              <View style={styles.routeRow}>
                <Ionicons name="storefront" size={14} color={ORDER_THEME.textSecondary} />
                <Text style={styles.routeText}>{item.storeName}</Text>
                <Ionicons name="arrow-forward" size={12} color={ORDER_THEME.textSecondary} />
                <Ionicons name="location" size={14} color={ORDER_THEME.textSecondary} />
                <Text style={styles.routeText}>{item.dropoffName}</Text>
              </View>

              <Text style={styles.itemSummary}>{item.itemSummary} · ค่าสินค้าประมาณ ฿{item.itemTotal.toFixed(0)}</Text>

              <TouchableOpacity style={styles.claimBtn} onPress={() => handleClaim(item.id)} disabled={claimingId === item.id}>
                {claimingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.claimBtnText}>รับงานนี้</Text>}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ORDER_THEME.backgroundAlt },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: ORDER_THEME.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: ORDER_THEME.textPrimary },
  headerSubtitle: { fontSize: 11, color: ORDER_THEME.textSecondary, marginTop: 2 },
  emptyText: { textAlign: 'center', color: ORDER_THEME.textSecondary, marginTop: 40 },
  card: {
    backgroundColor: ORDER_THEME.surface, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: ORDER_THEME.border, gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: ORDER_THEME.info,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: ORDER_THEME.surface, fontWeight: 'bold', fontSize: 12 },
  requesterName: { fontSize: 14, fontWeight: '700', color: ORDER_THEME.textPrimary, marginBottom: 4 },
  fee: { fontSize: 14, fontWeight: 'bold', color: ORDER_THEME.accent },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  routeText: { fontSize: 12, color: ORDER_THEME.textPrimary, fontWeight: '500' },
  itemSummary: { fontSize: 12, color: ORDER_THEME.textSecondary },
  claimBtn: { backgroundColor: ORDER_THEME.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  claimBtnText: { color: ORDER_THEME.surface, fontWeight: 'bold', fontSize: 13 },
});
