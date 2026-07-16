import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

interface NotifItem {
  id: string;
  title: string;
  subtitle?: string;
  timeLabel: string;
  orderId?: number;
}

const STATUS_TEXT: Record<string, string> = {
  accepted: 'ออเดอร์ของคุณถูกรับแล้ว',
  buying: 'กำลังซื้อสินค้าให้คุณ',
  bought: 'ซื้อสินค้าเสร็จแล้ว รอยืนยัน Proof',
  delivering: 'กำลังนำส่งของถึงคุณแล้ว',
  completed: 'จัดส่งสำเร็จแล้ว! ตรวจสอบของได้เลย',
  cancelled: 'ออเดอร์ถูกยกเลิก',
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;

    const { data: myOrders } = await supabase
      .from('orders')
      .select('id')
      .or(`requester_id.eq.${uid},runner_id.eq.${uid}`);

    const orderIds = (myOrders || []).map((o) => o.id);
    if (orderIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: logs } = await supabase
      .from('order_status_logs')
      .select('id, order_id, status, changed_at')
      .in('order_id', orderIds)
      .order('changed_at', { ascending: false })
      .limit(20);

    if (logs) {
      setItems(
        logs.map((log) => ({
          id: String(log.id),
          title: STATUS_TEXT[log.status] || `อัปเดตสถานะ: ${log.status}`,
          subtitle: `Order #${log.order_id}`,
          timeLabel: timeAgo(log.changed_at),
          orderId: log.order_id,
        }))
      );
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="การแจ้งเตือน" />

      {loading ? (
        <ActivityIndicator color="#FF7A30" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications-off-outline" title="ยังไม่มีการแจ้งเตือน" subtitle="เมื่อสถานะคำขอฝากหิ้วเปลี่ยนไป ระบบจะแจ้งให้คุณทราบทันที" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.notifItem}
              onPress={() => item.orderId && router.push({ pathname: '/orders/order-detail', params: { orderId: item.orderId } })}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="notifications" size={16} color="#FF7A30" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                {!!item.subtitle && <Text style={styles.notifSubtitle}>{item.subtitle}</Text>}
              </View>
              <Text style={styles.notifTime}>{item.timeLabel}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  notifItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#F5EBE1', gap: 12,
    shadowColor: '#3A2113', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1
  },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF3EB', alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#3A2113' },
  notifSubtitle: { fontSize: 11, color: '#8B7E74', marginTop: 2 },
  notifTime: { fontSize: 10, color: '#B0A498', marginLeft: 8, fontWeight: '500' },
});