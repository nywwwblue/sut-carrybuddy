import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { ORDER_THEME } from '@/constants/OrderTheme';
import { StatusPill } from '@/components/StatusPill';

interface MyOrderRequest {
  id: number;
  status: string;
  created_at: string;
  itemTotal: number;
  fee: number;
  storeName: string;
  dropoffName: string;
  itemsText: string;
  paymentMode: string;
}

function formatCreatedAt(value: string) {
  try {
    return new Date(value).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'ไม่ทราบวันที่';
  }
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
        id, status, created_at, item_total, fee, payment_mode,
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
          paymentMode: row.payment_mode || 'wallet',
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
      <ScreenHeader title="คำขอฝากซื้อของฉัน" subtitle="รายการฝากหิ้วและคำสั่งซื้อทั้งหมดของคุณ" />

      {loading && orders.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORDER_THEME.accent} />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState icon="receipt-outline" title="ยังไม่มีคำขอฝากซื้อ" subtitle="คุณยังไม่เคยสร้างคำขอฝากหิ้วสินค้าในระบบ" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMyOrders} tintColor={ORDER_THEME.accent} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/orders/order-detail', params: { orderId: item.id } } as any)}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderId}>Order #{item.id}</Text>
                  <Text style={styles.metaText}>{formatCreatedAt(item.created_at)}</Text>
                </View>
                <StatusPill status={item.status} size="small" />
              </View>

              <View style={styles.routeBlock}>
                <View style={styles.routeRow}>
                  <Ionicons name="storefront" size={14} color={ORDER_THEME.accent} />
                  <Text style={styles.routeText}>{item.storeName}</Text>
                </View>
                <View style={styles.routeRow}>
                  <Ionicons name="location" size={14} color={ORDER_THEME.accent} />
                  <Text style={styles.routeText}>{item.dropoffName}</Text>
                </View>
              </View>

              <Text style={styles.itemsText} numberOfLines={2}>📦 {item.itemsText || 'ไม่มีรายการสินค้า'}</Text>

              <View style={styles.footerRow}>
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>ค่าหิ้ว ฿{item.fee}</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{item.paymentMode === 'cod' ? 'COD' : 'Wallet'}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={ORDER_THEME.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ORDER_THEME.backgroundAlt },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: {
    backgroundColor: ORDER_THEME.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderId: { fontSize: 14, fontWeight: 'bold', color: ORDER_THEME.textPrimary },
  metaText: { fontSize: 12, color: ORDER_THEME.textSecondary, marginTop: 3 },
  routeBlock: {
    backgroundColor: ORDER_THEME.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 10,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeText: { fontSize: 13, fontWeight: '600', color: ORDER_THEME.textPrimary, flex: 1 },
  itemsText: { fontSize: 12, color: ORDER_THEME.textSecondary, lineHeight: 18, marginBottom: 10 },
  footerRow: {
    borderTopWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    paddingTop: 10,
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: ORDER_THEME.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: ORDER_THEME.accent },
});