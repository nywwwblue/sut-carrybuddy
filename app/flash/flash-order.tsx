import React, { useEffect, useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader'; 
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
  const [timeLeft, setTimeLeft] = useState('00:00');

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
      .in('status', ['accepted', 'delivering', 'pending']);

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

  // ฟังก์ชันปิดเซสชันเมื่อหมดเวลา
  const handleExpireSession = useCallback(async () => {
    if (!flashPostId) return;
    await supabase.from('runner_posts').update({ status: 'closed' }).eq('id', flashPostId);
    await supabase.from('flash_buy_sessions').update({ status: 'closed' }).eq('post_id', flashPostId);
    
    Alert.alert('หมดเวลา Flash Buy', 'ครบกำหนดเวลาแล้ว ระบบปิดรับออเดอร์ด่วนอัตโนมัติ');
    router.replace('/runner/runner-home');
  }, [flashPostId, router]);

  // ระบบคำนวณเวลาถอยหลังจริงจาก DB (expires_at)
  useEffect(() => {
    if (!flashPostId) return;

    let timer: ReturnType<typeof setInterval>;

    const fetchAndStartTimer = async () => {
      const { data, error } = await supabase
        .from('flash_buy_sessions')
        .select('expires_at')
        .eq('post_id', flashPostId)
        .single();

      if (error || !data?.expires_at) return;

      const expireTime = new Date(data.expires_at).getTime();

      const updateTimer = () => {
        const now = new Date().getTime();
        const diffInSeconds = Math.floor((expireTime - now) / 1000);

        if (diffInSeconds <= 0) {
          setTimeLeft('00:00');
          if (timer) clearInterval(timer);
          handleExpireSession();
        } else {
          const mins = Math.floor(diffInSeconds / 60);
          const secs = diffInSeconds % 60;
          setTimeLeft(
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          );
        }
      };

      updateTimer();
      timer = setInterval(updateTimer, 1000);
    };

    fetchAndStartTimer();

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [flashPostId, handleExpireSession]);

  useEffect(() => {
    if (!flashPostId) return;
    loadIncomingOrders();

    const interval = setInterval(() => {
      loadIncomingOrders();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [flashPostId, loadIncomingOrders]);

  const totalBundleFee = incomingOrders.reduce((sum, order) => sum + order.fee, 0);

  const handleAcceptBundle = async () => {
    if (incomingOrders.length === 0) return;
    const orderIds = incomingOrders.map(o => o.id);
    const { error } = await supabase.from('orders').update({ status: 'accepted' }).in('id', orderIds);

    if (!error) {
      router.push({
        pathname: '/shopping-list' as any,
        params: { orderIds: JSON.stringify(orderIds), totalFee: totalBundleFee }
      });
    }
  };

  const handleManualCloseFlash = async () => {
    if (!flashPostId) {
      router.replace('/(runner-tabs)');
      return;
    }

    await supabase.from('runner_posts').update({ status: 'closed' }).eq('id', flashPostId);
    await supabase.from('flash_buy_sessions').update({ status: 'closed' }).eq('post_id', flashPostId);

    Alert.alert('ปิดบอร์ดสำเร็จ', 'คุณได้ปิดรับออเดอร์ด่วนเรียบร้อยแล้ว');
    router.replace('/(runner-tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 🛠️ ใช้ ScreenHeader กลาง แบบไม่มีแถบขาว เพื่อให้สอดคล้องกับหน้าอื่น */}
      <ScreenHeader title="Live Flash Buy: กำลังรับออเดอร์" subtitle={`เส้นทาง: ${routePass}`} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.timerCard}>
          <Text style={styles.timerStatusText}>เวลาคงเหลือ</Text>
          <Text style={styles.timerDigits}>{timeLeft}</Text>
          <Text style={styles.timerNote}>บอร์ดจะปิดอัตโนมัติเมื่อครบกำหนดเวลา</Text>
        </View>

        <Text style={styles.sectionTitle}>ออเดอร์ด่วนที่เข้ามา ({incomingOrders.length})</Text>
        
        {loading ? (
          <ActivityIndicator color="#FF7A30" style={{ marginVertical: 20 }} />
        ) : incomingOrders.length === 0 ? (
          <Text style={styles.emptyText}>ยังไม่มีออเดอร์ด่วนส่งเข้ามาในช่วงเวลานี้...</Text>
        ) : (
          incomingOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <Text style={styles.orderText}>{order.name} → {order.destination}</Text>
              <Text style={styles.cardFee}>+{order.fee}฿</Text>
            </View>
          ))
        )}

        <TouchableOpacity 
          style={[styles.mainBundleBtn, incomingOrders.length === 0 && { backgroundColor: '#E8D5C4' }]} 
          onPress={handleAcceptBundle} 
          disabled={incomingOrders.length === 0}
        >
          <Text style={styles.mainBundleBtnText}>รับทั้งหมด Bundle {totalBundleFee}฿</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.mainBundleBtn, { backgroundColor: '#E74C3C', marginTop: 12 }]} 
          onPress={handleManualCloseFlash}
        >
          <Text style={styles.mainBundleBtnText}>ปิดบอร์ด Flash Buy</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' }, // 👈 ปรับสีพื้นหลังให้ตรงกับธีมหลัก
  scrollContent: { padding: 20 },
  timerCard: {
    backgroundColor: '#FF7A30',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF7A30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  timerStatusText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  timerDigits: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', letterSpacing: 2 },
  timerNote: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 11, marginTop: 8, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#3A2113', marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#B0A498', fontSize: 13, marginVertical: 20 },
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
  orderText: { fontSize: 13, fontWeight: 'bold', color: '#3A2113', flex: 1 },
  cardFee: { fontSize: 14, fontWeight: 'bold', color: '#2ECC71' },
  mainBundleBtn: {
    backgroundColor: '#FF7A30',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#FF7A30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  mainBundleBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});