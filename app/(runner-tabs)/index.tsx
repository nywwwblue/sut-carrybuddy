import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import FlashLiveModal from '@/components/FlashLiveModal';

interface HistoryItem {
  id: number;
  route: string;
  amount: number;
}

interface IncomingOrder {
  id: string;
  name: string;
  destination: string;
  fee: number;
}

export default function RunnerHomeScreen() {
  const router = useRouter();
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // เพิ่มสเตตัสควบคุม Pop-up บอร์ด Live ด่วน
  const [liveModalVisible, setLiveModalVisible] = useState(false);
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [incomingOrders, setIncomingOrders] = useState<IncomingOrder[]>([]);
  const [timeLeft, setTimeLeft] = useState('05:00');
  const [liveLoading, setLiveLoading] = useState(false);

  // ฟังก์ชันดึงรายการออเดอร์ด่วนเรียลไทม์ที่คนฝากกดจอยพ่วงเข้ามา
  const loadLiveIncomingOrders = useCallback(async (postId: number) => {
    setLiveLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, fee, status,
        requester:requester_id ( name ),
        dropoff:dropoff_id ( name ),
        custom_dropoff_label
      `)
      .eq('post_id', postId)
      .in('status', ['accepted', 'delivering']);

    if (!error && data) {
      const rows = data as any[];
      setIncomingOrders(
        rows.map((row) => ({
          id: String(row.id),
          name: row.requester?.name || 'ลูกค้า',
          destination: row.dropoff?.name || row.custom_dropoff_label || 'จุดรับของ มทส.',
          fee: Number(row.fee) || 0,
        }))
      );
    }
    setLiveLoading(false);
  }, []);

  // เช็คว่าปัจจุบันไรเดอร์มีโพสต์ด่วนที่กำลัง Active อยู่หรือไม่
  const checkActiveFlashSession = useCallback(async (uid: string) => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('flash_buy_sessions')
      .select('id, post_id, expires_at')
      .eq('runner_id', uid)
      .eq('status', 'active')
      .gt('expires_at', now)
      .maybeSingle();

    if (data) {
      setActivePostId(data.post_id);
      // คำนวณเวลาเบื้องต้น
      const diff = +new Date(data.expires_at) - +new Date();
      if (diff > 0) {
        const mins = Math.floor((diff / 1000 / 60) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
      loadLiveIncomingOrders(data.post_id);
    } else {
      setActivePostId(null);
    }
  }, [loadLiveIncomingOrders]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;

    // เช็คเซสชันบอร์ดด่วนของตัวเอง
    await checkActiveFlashSession(uid);

    const [walletRes, ordersRes] = await Promise.all([
      supabase.from('wallets').select('id').eq('user_id', uid).single(),
      supabase
        .from('orders')
        .select(`
          id, status, fee, custom_dropoff_label,
          store:store_id ( name ),
          dropoff:dropoff_id ( name ),
          post:post_id ( 
            store:store_id ( name ), 
            dropoff:dropoff_id ( name ) 
          )
        `)
        .eq('runner_id', uid)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (ordersRes.data) {
      const orders = ordersRes.data as any[];
      const completed = orders.filter((o) => o.status === 'completed');
      setTotalJobs(orders.length);
      setSuccessRate(orders.length > 0 ? Math.round((completed.length / orders.length) * 100) : 0);
      
      setHistory(
        completed.slice(0, 4).map((o) => {
          const storeName = o.store?.name || o.post?.store?.name || 'ร้านค้า มทส.';
          const dropoffName = o.dropoff?.name || o.custom_dropoff_label || o.post?.dropoff?.name || 'จุดรับของ';
          
          return {
            id: o.id,
            route: `${storeName} → ${dropoffName}`,
            amount: Number(o.fee),
          };
        })
      );
    }

    if (walletRes.data) {
      const { data: earnRows } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('wallet_id', walletRes.data.id)
        .eq('tx_type', 'earn');
      if (earnRows) {
        setTotalEarnings(earnRows.reduce((sum, r) => sum + Number(r.amount), 0));
      }
    }

    setLoading(false);
  }, [checkActiveFlashSession]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ดักฟัง Realtime ดึงออเดอร์ใหม่เมื่อมีคนกดฝากซื้อด่วนพ่วงเข้ามา
  useEffect(() => {
    if (!activePostId) return;

    const channel = supabase
      .channel(`runner-live-orders-${activePostId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `post_id=eq.${activePostId}` }, () => {
        loadLiveIncomingOrders(activePostId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activePostId, loadLiveIncomingOrders]);

  const handleAcceptBundle = async () => {
    if (incomingOrders.length === 0) return;
    const orderIds = incomingOrders.map(o => o.id);
    const totalBundleFee = incomingOrders.reduce((sum, o) => sum + o.fee, 0);

    const { error } = await supabase
      .from('orders')
      .update({ status: 'delivering' })
      .in('id', orderIds);

    if (!error) {
      setLiveModalVisible(false);
      router.push({
        pathname: '/shopping-list' as any,
        params: { orderIds: JSON.stringify(orderIds), totalFee: totalBundleFee }
      });
    }
  };

  const handleCancelFlash = async () => {
    if (!activePostId) return;
    await supabase
      .from('flash_buy_sessions')
      .update({ status: 'closed' })
      .eq('post_id', activePostId);
    
    setLiveModalVisible(false);
    setActivePostId(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#FF7A30" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <Ionicons name="bicycle" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.headerTitle}>Runner Mode</Text>
          </View>
          <TouchableOpacity style={styles.bellButton} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications" size={20} color="#FF7A30" />
          </TouchableOpacity>
        </View>

        {/* 🛠️ ปุ่มแจ้งเตือนด่วนแถบสีส้มลอยเมื่อบอร์ดด่วนออนไลน์อยู่ */}
        {activePostId && (
          <TouchableOpacity 
            style={styles.flashOnlineBadge}
            onPress={() => setLiveModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.badgeLeft}>
              <Ionicons name="flash" size={14} color="#FFFFFF" />
              <Text style={styles.flashOnlineText}>บอร์ดด่วนกำลังออนไลน์ ({incomingOrders.length} ออเดอร์)</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>ยอดรายได้สะสมฝั่งไรเดอร์</Text>
          <Text style={styles.earningsAmount}>฿{totalEarnings.toFixed(0)}</Text>
          <Text style={styles.earningsSub}>{history.length} งานสำเร็จเสร็จสิ้นล่าสุด</Text>

          <View style={styles.earningsStatsRow}>
            <View style={styles.earningsStatBox}>
              <Text style={styles.earningsStatNumber}>{totalJobs}</Text>
              <Text style={styles.earningsStatLabel}>งานทั้งหมด</Text>
            </View>
            <View style={styles.earningsStatBox}>
              <Text style={styles.earningsStatNumber}>{successRate}%</Text>
              <Text style={styles.earningsStatLabel}>อัตราสำเร็จ</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/runner/create-route-post')}>
            <Ionicons name="list-outline" size={22} color="#FF7A30" />
            <Text style={styles.actionCardText}>สร้างประกาศรับหิ้วปกติ</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={() => activePostId ? setLiveModalVisible(true) : router.push('/flash/flash-controller')}
          >
            <Ionicons name="flash-outline" size={22} color="#FF7A30" />
            <Text style={styles.actionCardText}>
              {activePostId ? 'ดูกระดานรับด่วนสด' : 'เปิดบอร์ดรับหิ้วด่วน\n(Flash Buy)'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/runner/route-pooling-filter')}>
            <Ionicons name="albums-outline" size={22} color="#FF7A30" />
            <Text style={styles.actionCardText}>รับงานพ่วง{"\n"}ตามปลายทาง</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/runner/open-requests-board')}>
            <Ionicons name="megaphone-outline" size={22} color="#FF7A30" />
            <Text style={styles.actionCardText}>บอร์ดคำขอเปิด{"\n"}(ยังไม่มีคนรับ)</Text>
          </TouchableOpacity>
        </View>

        {/* History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>ประวัติการรับงานใน มทส.</Text>
            <TouchableOpacity onPress={() => router.push('/orders/order-history')}>
              <Text style={styles.historyLink}>ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#FF7A30" style={{ marginTop: 20 }} />
          ) : history.length === 0 ? (
            <Text style={styles.emptyText}>ยังไม่มีประวัติงานที่เสร็จสมบูรณ์</Text>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyRouteBox}>
                  <Ionicons name="location-outline" size={14} color="#FF7A30" style={{ marginTop: 1 }} />
                  <Text style={styles.historyRoute} numberOfLines={1}>{item.route}</Text>
                </View>
                <Text style={styles.historyAmount}>+฿{item.amount.toFixed(0)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* 🛠️ 2. แปะหน้าต่างโมดอลป๊อปอัปสถานะสดไว้ล่างสุดของสกรีน */}
      <FlashLiveModal
        visible={liveModalVisible}
        timeLeft={timeLeft}
        loading={liveLoading}
        incomingOrders={incomingOrders}
        onClose={() => setLiveModalVisible(false)}
        onAcceptBundle={handleAcceptBundle}
        onCancelFlash={handleCancelFlash}
      />
    </SafeAreaView>
  );
}

// 🎨 จัดโครงสร้างสไตล์ Property แยกแถวแนวตั้ง มินิมอลสมมาตร
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFBF7' 
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 20, 
    paddingTop: 16, 
    paddingBottom: 8,
  },
  headerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  iconBox: {
    width: 34, 
    height: 34, 
    borderRadius: 10, 
    backgroundColor: '#FF7A30',
    alignItems: 'center', 
    justifyContent: 'center',
  },
  headerTitle: { 
    fontSize: 17, 
    fontWeight: 'bold', 
    color: '#3A2113' 
  },
  bellButton: {
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    backgroundColor: '#FFFFFF',
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#F5EBE1'
  },
  flashOnlineBadge: {
    backgroundColor: '#FF7A30',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flashOnlineText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  earningsCard: {
    marginHorizontal: 20, 
    marginTop: 16, 
    backgroundColor: '#FF7A30', 
    borderRadius: 20, 
    padding: 20, 
    gap: 4,
    shadowColor: '#FF7A30', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 8, 
    elevation: 2
  },
  earningsLabel: { 
    color: 'rgba(255,255,255,0.85)', 
    fontSize: 13, 
    fontWeight: '500' 
  },
  earningsAmount: { 
    color: '#FFFFFF', 
    fontSize: 32, 
    fontWeight: 'bold' 
  },
  earningsSub: { 
    color: 'rgba(255,255,255,0.9)', 
    fontSize: 12, 
    marginBottom: 12, 
    fontWeight: '500' 
  },
  earningsStatsRow: { 
    flexDirection: 'row', 
    gap: 12 
  },
  earningsStatBox: {
    flex: 1, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    paddingVertical: 12, 
    alignItems: 'center',
  },
  earningsStatNumber: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#FF7A30' 
  },
  earningsStatLabel: { 
    fontSize: 11, 
    color: '#8B7E74', 
    fontWeight: '600', 
    marginTop: 2 
  },
  actionsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    paddingHorizontal: 20, 
    marginTop: 20 
  },
  actionCard: {
    flexBasis: '48%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#F5EBE1',
    padding: 16, 
    alignItems: 'center', 
    gap: 10, 
    justifyContent: 'center', 
    minHeight: 96,
    shadowColor: '#3A2113', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.01, 
    shadowRadius: 4, 
    elevation: 1
  },
  actionCardText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#3A2113', 
    textAlign: 'center', 
    lineHeight: 18 
  },
  historySection: { 
    paddingHorizontal: 20, 
    marginTop: 24 
  },
  historyHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  historyTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#3A2113' 
  },
  historyLink: { 
    fontSize: 13, 
    color: '#FF7A30', 
    fontWeight: '700' 
  },
  historyItem: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    padding: 14, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#F5EBE1'
  },
  historyRouteBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    flex: 1, 
    marginRight: 16 
  },
  historyRoute: { 
    fontSize: 13, 
    color: '#3A2113', 
    fontWeight: '600' 
  },
  historyAmount: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#2ECC71' 
  },
  emptyText: { 
    fontSize: 13, 
    color: '#B0A498', 
    textAlign: 'center', 
    marginTop: 14 
  },
  spacer: { 
    height: 40 
  },
});