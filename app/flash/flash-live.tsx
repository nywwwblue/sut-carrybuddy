import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface IncomingOrder {
  id: string;
  name: string;
  destination: string;
  fee: number;
}

export default function FlashLiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const flashPostId = params.postId ? Number(params.postId) : null;
  const routePass = (params.routePass as string) || 'สุรนิเวศ 16';

  const [incomingOrders, setIncomingOrders] = useState<IncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState('05:00');

  // ดึงข้อมูลออเดอร์สดจากฐานข้อมูล
  const loadIncomingOrders = useCallback(async () => {
    if (!flashPostId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, fee, status,
        requester:requester_id ( name ),
        dropoff:dropoff_id ( name ),
        custom_dropoff_label
      `)
      .eq('post_id', flashPostId)
      .in('status', ['accepted', 'delivering']);

    if (!error && data) {
      setIncomingOrders(data.map((row: any) => ({
        id: String(row.id),
        name: row.requester?.name || 'ลูกค้า',
        destination: row.dropoff?.name || row.custom_dropoff_label || routePass,
        fee: Number(row.fee) || 0,
      })));
    }
    setLoading(false);
  }, [flashPostId, routePass]);

  // ใช้ useEffect เพื่อดักฟังการเปลี่ยนแปลงของออเดอร์ (Realtime)
  useEffect(() => {
    if (!flashPostId) return;
    loadIncomingOrders();

    const channel = supabase
      .channel('live_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `post_id=eq.${flashPostId}` }, () => {
        loadIncomingOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [flashPostId, loadIncomingOrders]);

  const totalBundleFee = incomingOrders.reduce((sum, order) => sum + order.fee, 0);

  const handleAcceptBundle = async () => {
    if (incomingOrders.length === 0) return;
    const orderIds = incomingOrders.map(o => o.id);
    const { error } = await supabase.from('orders').update({ status: 'delivering' }).in('id', orderIds);

    if (!error) {
      router.push({
        pathname: '/shopping-list',
        params: { orderIds: JSON.stringify(orderIds), totalFee: totalBundleFee }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>⚡ Live Flash Buy: กำลังรับออเดอร์</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.timerCard}>
          <Text style={styles.timerStatusText}>เวลาคงเหลือ</Text>
          <Text style={styles.timerDigits}>{timeLeft}</Text>
        </View>
        <Text style={styles.sectionTitle}>ออเดอร์ด่วนที่เข้ามา ({incomingOrders.length})</Text>
        {loading ? <ActivityIndicator color="#FF7A30" /> : incomingOrders.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            <Text style={styles.orderText}>{order.name} → {order.destination}</Text>
            <Text style={styles.cardFee}>+{order.fee}฿</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.mainBundleBtn} onPress={handleAcceptBundle} disabled={incomingOrders.length === 0}>
          <Text style={styles.mainBundleBtnText}>รับทั้งหมด Bundle {totalBundleFee}฿</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    orderText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3A2113',
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  headerBox: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E8D5C4',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF7A30',
  },
  scrollContent: {
    padding: 20,
  },
  timerCard: {
    backgroundColor: '#FF7A30',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  timerStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  progressCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  timerDigits: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  timerNote: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    marginTop: 14,
    textAlign: 'center',
  },
  liveSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  liveBadge: {
    backgroundColor: '#FFEBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveText: {
    fontSize: 9,
    color: '#FF4D4D',
    fontWeight: '800',
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderMeta: {
    flex: 1,
    paddingHorizontal: 12,
  },
  orderRoute: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  destHighlight: {
    color: '#8B7E74',
    fontWeight: '500',
  },
  cardFee: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  bundleHintCard: {
    backgroundColor: '#FFF3EB',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  bundleHintText: {
    fontSize: 12,
    color: '#3A2113',
    fontWeight: '700',
  },
  mainBundleBtn: {
    backgroundColor: '#FF7A30',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  mainBundleBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    color: '#8B7E74',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerBtn: {
    backgroundColor: '#FFF3EB',
    borderWidth: 1,
    borderColor: '#FF7A30',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  dangerBtnText: {
    color: '#FF7A30',
    fontSize: 14,
    fontWeight: '700',
  },
});