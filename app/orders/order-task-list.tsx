import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

interface OrderItem {
  id: number;
  item_name: string;
  quantity: number;
  est_price: number;
}

interface RunnerTask {
  id: number;
  status: string;
  paymentMode: string;
  requesterName: string;
  dropoffName: string;
  items: OrderItem[];
}

export default function OrderTaskListScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<RunnerTask[]>([]);
  const [loading, setLoading] = useState(true);

  // ดึงข้อมูลรายการงานทั้งหมดที่ค้างอยู่ในมือไรเดอร์
  const loadMyTasks = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, payment_mode,
        requester:requester_id ( name ),
        dropoff:dropoff_id ( name ), custom_dropoff_label,
        order_items ( id, item_name, quantity, est_price )
      `)
      .eq('runner_id', userData.user.id)
      .in('status', ['accepted', 'buying', 'bought', 'delivering'])
      .order('created_at', { ascending: true });

    if (!error && data) {
      setTasks(
        (data as any[]).map((row) => ({
          id: row.id,
          status: row.status,
          paymentMode: row.payment_mode,
          requesterName: row.requester?.name || 'ไม่ทราบชื่อ',
          dropoffName: row.dropoff?.name || row.custom_dropoff_label || 'จุดรับส่งใน มทส.',
          items: (row.order_items || []).map((i: any) => ({
            id: i.id,
            item_name: i.item_name,
            quantity: i.quantity,
            est_price: Number(i.est_price),
          })),
        }))
      );
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyTasks();
    }, [loadMyTasks])
  );

  // ตัวช่วยแปลงสถานะเป็นข้อความไทยสวยๆ พร้อมสีป้าย
  const renderStatusBadge = (status: string) => {
    let label = 'รับงานแล้ว';
    let bg = '#FFF3EB';
    let color = '#FF7A30';

    if (status === 'buying') {
      label = 'กำลังซื้อของ';
      bg = '#E6F3FF';
      color = '#2980B9';
    } else if (status === 'bought') {
      label = 'ซื้อแล้วรอนำส่ง';
      bg = '#FEF9E7';
      color = '#F39C12';
    } else if (status === 'delivering') {
      label = 'กำลังเดินทาง';
      bg = '#E8F8F5';
      color = '#16A085';
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusText, { color }]}>{label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="ใบงานรับหิ้วของฉัน" subtitle="รายการงานที่กำลังดำเนินการทั้งหมดใน มทส." />

      {loading && tasks.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF7A30" />
        </View>
      ) : tasks.length === 0 ? (
        <EmptyState icon="clipboard-outline" title="ไม่มีงานค้างอยู่ในมือ" subtitle="คุณสามารถเปิดบอร์ดรับด่วนหรือรับคำขอเปิดเพื่อเพิ่มงานได้" />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMyTasks} tintColor="#FF7A30" />}
          renderItem={({ item }) => (
            /* กดที่การ์ดเพื่อพุ่งไปหน้าดูรายละเอียดเต็มๆ ของออเดอร์นั้น */
            <TouchableOpacity 
              style={styles.taskCard} 
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/orders/order-detail', params: { orderId: item.id } })}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderIdText}>Order #{item.id}</Text>
                  <Text style={styles.customerText}>ผู้ฝาก: คุณ {item.requesterName}</Text>
                </View>
                {renderStatusBadge(item.status)}
              </View>

              <Text style={styles.dropoffText}>📍 จุดส่ง: {item.dropoffName}</Text>
              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>รายการสินค้าเบื้องต้น:</Text>
              {item.items.map((it, idx) => (
                <Text key={idx} style={styles.itemName}>• {it.item_name}  ×{it.quantity}</Text>
              ))}

              <View style={styles.cardFooter}>
                <Text style={styles.detailHintText}>แตะเพื่อดูรายละเอียด & อัปเดตสถานะ</Text>
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
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  taskCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F5EBE1', shadowColor: '#3A2113', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderIdText: { fontSize: 15, fontWeight: 'bold', color: '#3A2113' },
  customerText: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  dropoffText: { fontSize: 13, fontWeight: '600', color: '#5C4638', marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#F5EBE1', marginVertical: 12 },
  sectionLabel: { fontSize: 13, fontWeight: 'bold', color: '#3A2113', marginBottom: 6 },
  itemName: { fontSize: 13, color: '#5C4638', paddingVertical: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 8, borderTopWidth: 1, borderColor: '#FAF3ED' },
  detailHintText: { fontSize: 12, color: '#FF7A30', fontWeight: '600' },
});