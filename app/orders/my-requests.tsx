import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

interface MyOrderRequest {
  id: number;
  status: string;
  created_at: string;
  itemTotal: number;
  fee: number;
  storeName: string;
  dropoffName: string;
  itemsText: string;
}

export default function MyOrderRequestsHistory() {
  const router = useRouter();
  const [orders, setOrders] = useState<MyOrderRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyOrders = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, created_at, item_total, fee,
        store:store_id ( name ),
        dropoff:dropoff_id ( name ),
        custom_dropoff_label,
        order_items ( item_name, quantity )
      `)
      .eq('requester_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(
        (data as any[]).map((row) => ({
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          itemTotal: Number(row.item_total),
          fee: Number(row.fee),
          storeName: row.store?.name || 'พิกัดร้านค้า',
          dropoffName: row.dropoff?.name || row.custom_dropoff_label || 'จุดส่งของ',
          itemsText: (row.order_items || []).map((i: any) => `${i.item_name} x${i.quantity}`).join(', '),
        }))
      );
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyOrders();
    }, [loadMyOrders])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="คำขอฝากซื้อของฉัน" subtitle="รายการโพสต์ฝากหิ้วและสั่งซื้อทั้งหมดของคุณ" />

      {loading && orders.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF7A30" />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState icon="receipt-outline" title="ยังไม่มีคำขอฝากซื้อ" subtitle="คุณยังไม่เคยสร้างคำขอฝากหิ้วสินค้าในระบบ" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMyOrders} tintColor="#FF7A30" />}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/orders/order-detail', params: { orderId: item.id } } as any)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Order #{item.id}</Text>
                <Text style={[styles.statusText, item.status === 'pending' ? { color: '#FF7A30' } : { color: '#2ECC71' }]}>
                  {item.status === 'pending' ? 'รอรับงาน' : item.status === 'completed' ? 'สำเร็จแล้ว' : item.status}
                </Text>
              </View>
              <Text style={styles.routeText}>📍 {item.storeName} → {item.dropoffName}</Text>
              <Text style={styles.itemsText} numberOfLines={1}>📦 {item.itemsText}</Text>
              <View style={styles.footerRow}>
                <Text style={styles.priceText}>ค่าหิ้ว ฿{item.fee} | ค่าสินค้าประมาณ ฿{item.itemTotal.toFixed(0)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#C9BBAF" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F5EBE1', gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 14, fontWeight: 'bold', color: '#3A2113' },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  routeText: { fontSize: 13, fontWeight: '600', color: '#5C4638' },
  itemsText: { fontSize: 12, color: '#8B7E74' },
  footerRow: { borderTopWidth: 1, borderColor: '#F5EBE1', paddingTop: 8, marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceText: { fontSize: 12, fontWeight: 'bold', color: '#FF7A30' },
});