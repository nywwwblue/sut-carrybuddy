import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

interface PendingOrder {
  id: number;
  requesterName: string;
  itemSummary: string;
  fee: number;
  dropoffName: string;
}

interface DropoffGroup {
  dropoffName: string;
  orders: PendingOrder[];
  totalFee: number;
}

export default function RoutePoolingFilter() {
  const router = useRouter();
  const [selectedDropoff, setSelectedDropoff] = useState<string | null>(null);
  const [groups, setGroups] = useState<DropoffGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPendingOrders = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('orders')
      .select(
        `id, fee, requester:requester_id ( name ), order_items ( item_name ),
         post:post_id ( dropoff:dropoff_id ( name ) )`
      )
      .eq('runner_id', userData.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (data) {
      const rows = (data as any[]).map((row) => ({
        id: row.id,
        requesterName: row.requester?.name || 'ไม่ทราบชื่อ',
        itemSummary: row.order_items?.[0]?.item_name
          ? `${row.order_items[0].item_name}${row.order_items.length > 1 ? ` +${row.order_items.length - 1}` : ''}`
          : 'ไม่มีรายการ',
        fee: Number(row.fee),
        dropoffName: row.post?.dropoff?.name || 'ไม่ระบุปลายทาง',
      }));

      const grouped: DropoffGroup[] = [];
      rows.forEach((order) => {
        let group = grouped.find((g) => g.dropoffName === order.dropoffName);
        if (!group) {
          group = { dropoffName: order.dropoffName, orders: [], totalFee: 0 };
          grouped.push(group);
        }
        group.orders.push(order);
        group.totalFee += order.fee;
      });
      grouped.sort((a, b) => b.orders.length - a.orders.length);
      setGroups(grouped);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPendingOrders();
    }, [loadPendingOrders])
  );

  const acceptOrders = async (orderIds: number[]) => {
    await supabase.from('orders').update({ status: 'accepted' }).in('id', orderIds);
    Alert.alert('รับงานแล้ว', `รับ ${orderIds.length} ออเดอร์เรียบร้อย`, [
      { text: 'ไปที่ใบงานรวม', onPress: () => router.push('/orders/order-task-list') },
    ]);
    loadPendingOrders();
  };

  const dropoffTabs = groups.map((g) => g.dropoffName);
  const visibleGroups = selectedDropoff ? groups.filter((g) => g.dropoffName === selectedDropoff) : groups;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="ตัวกรองรับงานพ่วงตามตึกปลายทาง" subtitle="SUT Route Pooling สำหรับผู้รับหิ้ว" />

      {loading ? (
        <ActivityIndicator color="#FF7A30" style={{ marginTop: 40 }} />
      ) : groups.length === 0 ? (
        <EmptyState icon="albums-outline" title="ยังไม่มีออเดอร์ที่รอรับ" subtitle="คำขอฝากหิ้วที่ผูกกับเส้นทางของคุณจะแสดงที่นี่" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
          {/* Dropoff Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <TouchableOpacity
              style={[styles.tab, !selectedDropoff && styles.tabActive]}
              onPress={() => setSelectedDropoff(null)}
            >
              <Text style={[styles.tabText, !selectedDropoff && styles.tabTextActive]}>ทั้งหมด</Text>
            </TouchableOpacity>
            {dropoffTabs.map((name) => {
              const group = groups.find((g) => g.dropoffName === name)!;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.tab, selectedDropoff === name && styles.tabActive]}
                  onPress={() => setSelectedDropoff(name)}
                >
                  <Text style={[styles.tabText, selectedDropoff === name && styles.tabTextActive]}>{name}</Text>
                  <Text style={[styles.tabCount, selectedDropoff === name && styles.tabTextActive]}>{group.orders.length} งาน</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {visibleGroups.map((group) => (
            <View key={group.dropoffName} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Ionicons name="location" size={18} color="#FF7A30" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>รวมใบงานฝากหิ้วของติด {group.dropoffName}</Text>
                  <Text style={styles.groupSubtitle}>{group.orders.length} ออเดอร์ — Batch Delivery</Text>
                </View>
              </View>

              {group.orders.map((order, i) => (
                <View key={order.id} style={styles.orderRow}>
                  <View style={[styles.avatar, { backgroundColor: i % 2 === 0 ? '#4A90E2' : '#50C878' }]}>
                    <Text style={styles.avatarText}>{order.requesterName.slice(0, 2)}</Text>
                  </View>
                  <Text style={styles.orderText}>
                    {order.requesterName} — {order.itemSummary}
                  </Text>
                  <Text style={styles.orderFee}>฿{order.fee}</Text>
                </View>
              ))}

              {group.orders.length > 1 && (
                <TouchableOpacity style={styles.acceptAllBtn} onPress={() => acceptOrders(group.orders.map((o) => o.id))}>
                  <Text style={styles.acceptAllText}>กดรับงานกลุ่มนี้พ่วงไปด้วยกัน</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Individual */}
          <Text style={styles.sectionTitle}>รายการคำขอแยกใบงาน</Text>
          {visibleGroups.flatMap((g) => g.orders).map((order) => (
            <View key={order.id} style={styles.individualCard}>
              <View style={styles.individualRow}>
                <View style={[styles.avatar, { backgroundColor: '#4A90E2' }]}>
                  <Text style={styles.avatarText}>{order.requesterName.slice(0, 2)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderText, { fontWeight: 'bold', color: '#3A2113' }]}>คุณ {order.requesterName}</Text>
                  <Text style={styles.individualItem}>{order.itemSummary}</Text>
                </View>
                <Text style={styles.orderFee}>฿{order.fee}</Text>
              </View>
              <View style={styles.individualActions}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={async () => {
                    Alert.alert('ยืนยัน', 'คุณต้องการปฏิเสธคำขอฝากหิ้วนี้ใช่หรือไม่? ระบบจะทำการคืนมัดจำให้เพื่อนทันที', [
                      { text: 'ยกเลิก', style: 'cancel' },
                      {
                        text: 'ปฏิเสธงาน',
                        style: 'destructive',
                        onPress: async () => {
                          const { data: userData } = await supabase.auth.getUser();
                          if (!userData.user) return;

                          const { error } = await supabase.rpc('runner_reject_order', {
                            p_order_id: order.id,
                            p_runner_id: userData.user.id
                          });

                          if (error) {
                            Alert.alert('ผิดพลาด', error.message);
                          } else {
                            Alert.alert('สำเร็จ', 'ปฏิเสธคำขอเรียบร้อยแล้ว');
                            loadPendingOrders();
                          }
                        }
                      }
                    ]);
                  }}
                >
                  <Text style={styles.rejectBtnText}>ปฏิเสธ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptOneBtn} onPress={() => acceptOrders([order.id])}>
                  <Text style={styles.acceptOneBtnText}>รับงาน</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFBF7' 
  },
  tab: {
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 14, 
    backgroundColor: '#FFFFFF',
    marginRight: 10, 
    borderWidth: 1, 
    borderColor: '#F5EBE1', 
    alignItems: 'center',
    shadowColor: '#3A2113', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.02, 
    shadowRadius: 4, 
    elevation: 1
  },
  tabActive: { 
    backgroundColor: '#FF7A30', 
    borderColor: '#FF7A30' 
  },
  tabText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#3A2113' 
  },
  tabCount: { 
    fontSize: 10, 
    color: '#8B7E74', 
    marginTop: 2 
  },
  tabTextActive: { 
    color: '#FFFFFF' 
  },
  groupCard: {
    backgroundColor: '#FFFFFF', 
    borderWidth: 1.5, 
    borderColor: '#FF7A30', 
    borderRadius: 16,
    padding: 16, 
    marginBottom: 16, 
    gap: 10,
    shadowColor: '#FF7A30', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    elevation: 1
  },
  groupHeader: { 
    flexDirection: 'row', 
    gap: 10, 
    alignItems: 'center', 
    marginBottom: 4 
  },
  groupTitle: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    color: '#3A2113' 
  },
  groupSubtitle: { 
    fontSize: 11, 
    color: '#8B7E74', 
    marginTop: 2 
  },
  orderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    paddingVertical: 6 
  },
  avatar: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarText: { 
    color: '#FFFFFF', 
    fontSize: 11, 
    fontWeight: 'bold' 
  },
  orderText: { 
    flex: 1, 
    fontSize: 13, 
    color: '#5C4638' 
  },
  orderFee: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#FF7A30' 
  },
  acceptAllBtn: { 
    backgroundColor: '#FF7A30', 
    borderRadius: 12, 
    paddingVertical: 12, 
    alignItems: 'center', 
    marginTop: 6 
  },
  acceptAllText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 13 
  },
  sectionTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#3A2113', 
    marginBottom: 12, 
    marginTop: 4 
  },
  individualCard: {
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    padding: 14, 
    marginBottom: 10,
    borderWidth: 1, 
    borderColor: '#F5EBE1', 
    gap: 10,
  },
  individualRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  individualItem: { 
    fontSize: 11, 
    color: '#8B7E74', 
    marginTop: 2 
  },
  individualActions: { 
    flexDirection: 'row', 
    gap: 10 
  },
  rejectBtn: { 
    flex: 1, 
    borderWidth: 1, 
    borderColor: '#E74C3C', 
    borderRadius: 10, 
    paddingVertical: 10, 
    alignItems: 'center', 
    backgroundColor: '#FDECEC' 
  },
  rejectBtnText: { 
    color: '#E74C3C', 
    fontWeight: 'bold', 
    fontSize: 12 
  },
  acceptOneBtn: { 
    flex: 1, 
    backgroundColor: '#FF7A30', 
    borderRadius: 10, 
    paddingVertical: 10, 
    alignItems: 'center' 
  },
  acceptOneBtnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 12 
  },
});