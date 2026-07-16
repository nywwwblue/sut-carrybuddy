import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { TrustScoreBadge } from '@/components/TrustScoreBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

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
        <ActivityIndicator color="#FF7A30" style={{ marginTop: 40 }} />
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
                <Ionicons name="storefront" size={14} color="#8B7E74" />
                <Text style={styles.routeText}>{item.storeName}</Text>
                <Ionicons name="arrow-forward" size={12} color="#8B7E74" />
                <Ionicons name="location" size={14} color="#8B7E74" />
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
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#3A2113' },
  headerSubtitle: { fontSize: 11, color: '#8B7E74', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#8B7E74', marginTop: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E8D5C4', gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#4A90E2',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  requesterName: { fontSize: 14, fontWeight: '700', color: '#3A2113', marginBottom: 4 },
  fee: { fontSize: 14, fontWeight: 'bold', color: '#FF7A30' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  routeText: { fontSize: 12, color: '#3A2113', fontWeight: '500' },
  itemSummary: { fontSize: 12, color: '#8B7E74' },
  claimBtn: { backgroundColor: '#FF7A30', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  claimBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});
