import React, { useCallback, useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

// 📐 ฟังก์ชันคำนวณระยะทางทางตรงและแปลงเป็นเมตร/กิโลเมตร
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function calculateETA(distanceMeters: number) {
  const estimatedRoadDistance = distanceMeters * 1.35;
  const SPEED_METERS_PER_MIN = 416; // 25 กม./ชม.
  const minutes = Math.ceil(estimatedRoadDistance / SPEED_METERS_PER_MIN);

  let distanceText = '';
  if (estimatedRoadDistance >= 1000) {
    distanceText = `${(estimatedRoadDistance / 1000).toFixed(1)} กิโลเมตร`;
  } else {
    distanceText = `${Math.round(estimatedRoadDistance)} เมตร`;
  }

  return { distanceText, minutes: minutes < 1 ? 1 : minutes };
}

// 📡 คอมโพเนนต์ LiveTrackingCard สำหรับคนฝากหิ้ว
function LiveTrackingCard({ orderId, dropoffLat, dropoffLng }: { orderId: number | string; dropoffLat: number; dropoffLng: number }) {
  const [etaInfo, setEtaInfo] = useState<{ distanceText: string; minutes: number } | null>(null);

  useEffect(() => {
    if (!orderId || !dropoffLat || !dropoffLng) return;

    const channel = supabase
      .channel(`runner-location-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'runner_locations',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newLoc = payload.new as { lat: number; lng: number };
          if (newLoc?.lat && newLoc?.lng) {
            const meters = getDistanceInMeters(newLoc.lat, newLoc.lng, dropoffLat, dropoffLng);
            const eta = calculateETA(meters);
            setEtaInfo(eta);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, dropoffLat, dropoffLng]);

  if (!etaInfo) {
    return (
      <View style={trackingStyles.card}>
        <Ionicons name="bicycle" size={22} color="#8B7E74" />
        <Text style={trackingStyles.waitingText}>กำลังรอสัญญาณ GPS สดจากผู้รับหิ้ว...</Text>
      </View>
    );
  }

  return (
    <View style={trackingStyles.card}>
      <View style={trackingStyles.headerRow}>
        <View style={trackingStyles.liveBadge}>
          <View style={trackingStyles.greenDot} />
          <Text style={trackingStyles.liveText}>ติดตามสด (LIVE)</Text>
        </View>
        <Text style={trackingStyles.distanceText}>ห่างจากคุณ {etaInfo.distanceText}</Text>
      </View>

      <View style={trackingStyles.etaContainer}>
        <Ionicons name="time" size={26} color="#FF7A30" />
        <View>
          <Text style={trackingStyles.etaTitle}>คาดว่าจะถึงจุดส่งในอีก</Text>
          <Text style={trackingStyles.etaValue}>ประมาณ {etaInfo.minutes} นาที</Text>
        </View>
      </View>
    </View>
  );
}

const STEP_ORDER = ['pending', 'accepted', 'buying', 'bought', 'delivering', 'completed'];
const STEP_LABELS: Record<string, string> = {
  pending: 'รอผู้รับหิ้วตอบรับ',
  accepted: 'รับออเดอร์แล้ว',
  buying: 'กำลังซื้อสินค้า',
  bought: 'ซื้อแล้ว รอนำส่ง',
  delivering: 'กำลังเดินทาง',
  completed: 'จัดส่งสำเร็จ',
};

interface OrderDetail {
  id: number;
  status: string;
  payment_mode: 'wallet' | 'cod';
  item_total: number;
  fee: number;
  requester_id: string;
  runner_id: string | null;
  otherPartyName: string;
  otherPartyTrust: number;
  items: { item_name: string; quantity: number }[];
  dropoffLabel: string | null;
  storeLat: number | null;
  storeLng: number | null;
  storeLabel: string | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string | undefined;
  const viewMode = params.mode as string | undefined; // รองรับการส่ง mode='runner' หรือ 'requester'

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setMyUserId(uid);

    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, status, payment_mode, item_total, fee, requester_id, runner_id,
         custom_store_lat, custom_store_lng, custom_store_label,
         custom_dropoff_lat, custom_dropoff_lng, custom_dropoff_label,
         order_items ( item_name, quantity ),
         store:store_id ( name, lat, lng ),
         dropoff:dropoff_id ( name, lat, lng )`
      )
      .eq('id', orderId)
      .single();

    if (!error && data) {
      const row = data as any;
      const reqId = row.requester_id ? String(row.requester_id).trim() : '';
      const runId = row.runner_id ? String(row.runner_id).trim() : null;
      
      const isRunnerUser = uid && runId && String(uid).trim() === runId;
      const otherUserId = isRunnerUser ? reqId : runId;
      let otherName = 'ไม่ทราบชื่อ';
      let otherTrust = 100;

      if (otherUserId) {
        const { data: otherUser } = await supabase
          .from('users')
          .select('name, trust_scores(trust_score)')
          .eq('id', otherUserId)
          .single();
        if (otherUser) {
          otherName = otherUser.name || 'ไม่ทราบชื่อ';
          otherTrust = (otherUser as any).trust_scores?.[0]?.trust_score ?? 100;
        }
      }

      const storeLat = row.store?.lat ? Number(row.store.lat) : row.custom_store_lat ? Number(row.custom_store_lat) : null;
      const storeLng = row.store?.lng ? Number(row.store.lng) : row.custom_store_lng ? Number(row.custom_store_lng) : null;
      const storeLabel = row.store?.name || row.custom_store_label || 'ร้านค้า';

      const dropoffLat = row.dropoff?.lat ? Number(row.dropoff.lat) : row.custom_dropoff_lat ? Number(row.custom_dropoff_lat) : null;
      const dropoffLng = row.dropoff?.lng ? Number(row.dropoff.lng) : row.custom_dropoff_lng ? Number(row.custom_dropoff_lng) : null;
      const dropoffLabel = row.dropoff?.name || row.custom_dropoff_label || 'จุดส่งของ';

      setOrder({
        id: row.id,
        status: row.status,
        payment_mode: row.payment_mode,
        item_total: Number(row.item_total),
        fee: Number(row.fee),
        requester_id: reqId,
        runner_id: runId,
        otherPartyName: otherName,
        otherPartyTrust: otherTrust,
        items: row.order_items || [],
        dropoffLabel: dropoffLabel,
        storeLat,
        storeLng,
        storeLabel,
        dropoffLat,
        dropoffLng,
      });
    }
    setLoading(false);
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder])
  );

  // 🔑 ปรับแก้เงื่อนไขสิทธิ์ให้ทำงานถูกต้องแม้อยู่ในขั้นตอนทดสอบ:
  const uidStr = myUserId ? String(myUserId).trim() : '';
  const reqIdStr = order?.requester_id ? String(order.requester_id).trim() : '';
  const runIdStr = order?.runner_id ? String(order.runner_id).trim() : '';

  // ถ้าส่ง mode='runner' มา บังคับให้เป็น Runner ทันที หรือถ้าไอดีตรงกับ runner_id และไม่ตรงกับ requester_id
  const isRunner = viewMode === 'runner' || (Boolean(uidStr && runIdStr && uidStr === runIdStr) && uidStr !== reqIdStr);
  const isRequester = !isRunner;

  const currentStepIndex = order ? STEP_ORDER.indexOf(order.status) : -1;

  const openNavigation = (lat: number | null, lng: number | null, label: string | null) => {
    if (!lat || !lng) {
      Alert.alert('ไม่พบพิกัด', 'สถานที่นี้ไม่ได้ระบุพิกัดบนแผนที่ไว้');
      return;
    }

    const encodedLabel = encodeURIComponent(label || 'จุดหมาย');
    const scheme = Platform.OS === 'ios' ? 'maps:' : 'geo:';
    const url = Platform.select({
      ios: `${scheme}0,0?q=${encodedLabel}@${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    });

    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    Linking.canOpenURL(url!)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url!);
        } else {
          Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Linking.openURL(webUrl);
      });
  };

  const updateStatus = async (newStatus: string) => {
    if (!order) return;
    setUpdating(true);

    if (newStatus === 'completed' && order.payment_mode === 'wallet') {
      const { error } = await supabase.rpc('release_escrow_and_complete', { p_order_id: order.id });
      if (error) Alert.alert('ผิดพลาด', error.message);
    } else {
      await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
      await supabase.from('order_status_logs').insert({ order_id: order.id, changed_by: myUserId, status: newStatus });
    }
    setUpdating(false);
    loadOrder();
  };

  const handleConfirmCOD = async () => {
    if (!order) return;
    setUpdating(true);

    try {
      const { error: rpcError } = await supabase.rpc('settle_cod_order', {
        p_order_id: order.id,
        p_changed_by: myUserId
      });

      if (rpcError) throw rpcError;

      Alert.alert('สำเร็จ', 'ยืนยันรับเงินและจบงานเรียบร้อยแล้ว');
      router.replace('/(runner-tabs)');
    } catch (error: any) {
      Alert.alert('ผิดพลาด', error.message || 'ไม่สามารถยืนยันยอดเงินได้');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    Alert.alert('ยืนยัน', 'คุณต้องการยกเลิกคำขอฝากหิ้วนี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        style: 'destructive',
        onPress: async () => {
          setUpdating(true);
          await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
          await supabase.from('order_status_logs').insert({ order_id: order.id, changed_by: myUserId, status: 'cancelled', note: 'ผู้ใช้ยกเลิกออเดอร์' });
          
          setUpdating(false);
          Alert.alert('สำเร็จ', 'ยกเลิกออเดอร์เรียบร้อยแล้ว');
          router.back();
        }
      }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF7A30" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <Text style={{ color: '#8B7E74' }}>ไม่พบข้อมูลออเดอร์นี้</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ScreenHeader title="อัปเดตสถานะ" subtitle={`Order #${order.id}`} />

        {/* Timeline */}
        <View style={styles.timeline}>
          {STEP_ORDER.map((step, index) => {
            const completed = currentStepIndex > index;
            const current = currentStepIndex === index;
            return (
              <View key={step} style={styles.timelineItem}>
                <View style={[styles.timelineCircle, (completed || current) && styles.timelineCircleCompleted]}>
                  {completed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                {index < STEP_ORDER.length - 1 && (
                  <View style={[styles.timelineLine, completed && styles.timelineLineCompleted]} />
                )}
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, (completed || current) && styles.timelineLabelCompleted]}>
                    {STEP_LABELS[step]}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 📡 1. มุมมองฝั่งคนฝากหิ้ว (REQUESTER) */}
        {isRequester && (
          <View style={{ marginVertical: 4 }}>
            {/* LIVE TRACKING: แสดงระยะทางสด + เวลาคงเหลือ (เฉพาะตอนกำลังส่ง) */}
            {order.status === 'delivering' && (
              <LiveTrackingCard 
                orderId={order.id} 
                dropoffLat={order.dropoffLat ?? 0} 
                dropoffLng={order.dropoffLng ?? 0} 
              />
            )}

            {/* ปุ่มยกเลิกออเดอร์ */}
            {order.status === 'pending' && (
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOrder} disabled={updating}>
                <Text style={styles.cancelBtnText}>ยกเลิกออเดอร์นี้</Text>
              </TouchableOpacity>
            )}

            {/* ปุ่มให้คะแนนผู้รับหิ้ว */}
            {order.status === 'completed' && (
              <TouchableOpacity style={styles.rateBtn} onPress={() => router.push({ pathname: '/rate-rider', params: { orderId: order.id, runnerId: order.runner_id || '' } })}>
                <Ionicons name="star" size={18} color="#FFFFFF" />
                <Text style={styles.rateBtnText}>ให้คะแนนผู้รับหิ้ว</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 🧭 2. มุมมองฝั่งคนรับหิ้ว (RUNNER) */}
        {isRunner && (
          <View style={{ marginVertical: 4 }}>
            {/* ศูนย์นำทาง GPS */}
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <View style={styles.navSection}>
                <Text style={styles.navSectionTitle}>ศูนย์นำทาง (GPS Navigation)</Text>
                <View style={styles.navButtonRow}>
                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: '#FF7A30' }]}
                    onPress={() => openNavigation(order.storeLat, order.storeLng, order.storeLabel)}
                  >
                    <Ionicons name="cart" size={18} color="#FFFFFF" />
                    <Text style={styles.navBtnText}>ไปร้านค้า</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: '#2ECC71' }]}
                    onPress={() => openNavigation(order.dropoffLat, order.dropoffLng, order.dropoffLabel)}
                  >
                    <Ionicons name="navigate" size={18} color="#FFFFFF" />
                    <Text style={styles.navBtnText}>ไปจุดส่งของ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ปุ่มเลื่อนสถานะงาน */}
            {currentStepIndex >= 0 && currentStepIndex < STEP_ORDER.length - 1 && !(order.payment_mode === 'cod' && order.status === 'delivering') && (
              <TouchableOpacity style={styles.advanceBtn} onPress={() => updateStatus(STEP_ORDER[currentStepIndex + 1])} disabled={updating}>
                {updating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.advanceBtnText}>อัปเดตเป็น: {STEP_LABELS[STEP_ORDER[currentStepIndex + 1]]}</Text>}
              </TouchableOpacity>
            )}

            {/* ปุ่มชำระเงิน COD */}
            {order.payment_mode === 'cod' && order.status === 'delivering' && (
              <View style={styles.codSection}>
                <View style={styles.codHeader}>
                  <Ionicons name="cash" size={20} color="#4A90E2" />
                  <Text style={styles.codTitle}>COD Cash Settlement</Text>
                </View>
                <View style={styles.codAmount}>
                  <Text style={styles.codLabel}>ยอดที่ต้องรับ</Text>
                  <Text style={styles.codValue}>฿{order.fee.toFixed(0)}</Text>
                </View>
                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmCOD} disabled={updating}>
                  {updating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmButtonText}>ยืนยันการรับเงิน</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Items */}
        <View style={styles.itemsCard}>
          {!!order.storeLabel && (
            <View style={[styles.dropoffRow, { backgroundColor: '#FFF3EB' }]}>
              <Ionicons name="cart" size={14} color="#FF7A30" />
              <Text style={styles.dropoffText}>ร้านค้า: {order.storeLabel}</Text>
            </View>
          )}
          {!!order.dropoffLabel && (
            <View style={styles.dropoffRow}>
              <Ionicons name="location" size={14} color="#FF7A30" />
              <Text style={styles.dropoffText}>ส่งที่: {order.dropoffLabel}</Text>
            </View>
          )}
          <Text style={styles.itemsTitle}>รายการสินค้า</Text>
          {order.items.map((it, i) => (
            <Text key={i} style={styles.itemLine}>• {it.item_name} ×{it.quantity}</Text>
          ))}
          <View style={styles.divider} />
          <View style={styles.itemsTotalRow}>
            <Text style={styles.itemsTotalLabel}>รวม (สินค้า + ค่าหิ้ว)</Text>
            <Text style={styles.itemsTotalValue}>฿{(order.item_total + order.fee).toFixed(0)}</Text>
          </View>
        </View>

        {/* QR Code */}
        {order.payment_mode === 'wallet' && (
          <View style={styles.qrSection}>
            <View style={styles.qrContainer}>
              <View style={styles.qrBox}>
                <QRCode value={`CARRYBUDDY-ORDER-${order.id}`} size={140} color="#3A2113" backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.qrLabel}>QR รับสินค้า Order #{order.id}</Text>
            </View>
            {isRequester ? (
              <TouchableOpacity style={styles.regenerateButton} onPress={() => router.push({ pathname: '/qr-scanner', params: { orderId: order.id } })}>
                <Text style={styles.regenerateButtonText}>สแกน QR เพื่อรับสินค้าและจบงาน</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.qrHintText}>ให้ผู้ฝากสแกน QR นี้เพื่อปลดล็อกเงินและจบงาน</Text>
            )}
          </View>
        )}

        {/* Other party Info */}
        <View style={styles.riderSection}>
          <View style={styles.riderCard}>
            <View style={[styles.riderAvatar, { backgroundColor: '#4A90E2' }]}>
              <Text style={styles.riderAvatarText}>{order.otherPartyName.slice(0, 2)}</Text>
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{order.otherPartyName}</Text>
              <Text style={styles.riderTrust}>Trust {order.otherPartyTrust}</Text>
            </View>
            <TouchableOpacity style={styles.messageButton} onPress={() => router.push({ pathname: '/chat-detail/[id]', params: { id: String(order.id) } })}>
              <Ionicons name="chatbubble" size={20} color="#FF7A30" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const trackingStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'column',
  },
  waitingText: { fontSize: 13, color: '#8B7E74', marginLeft: 8, lineHeight: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F8F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71' },
  liveText: { fontSize: 11, fontWeight: 'bold', color: '#2ECC71' },
  distanceText: { fontSize: 12, fontWeight: '600', color: '#8B7E74' },
  etaContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF3EB', padding: 12, borderRadius: 12 },
  etaTitle: { fontSize: 12, color: '#8B7E74' },
  etaValue: { fontSize: 16, fontWeight: 'bold', color: '#FF7A30' },
});

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFBF7' 
  },
  centerContent: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  timeline: { 
    backgroundColor: '#FFFFFF', 
    marginHorizontal: 16, 
    marginVertical: 12, 
    borderRadius: 16, 
    padding: 20,
    shadowColor: '#3A2113', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2,
  },
  timelineItem: { 
    flexDirection: 'row', 
    minHeight: 50 
  },
  timelineCircle: {
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: '#F0E5DC',
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 16, 
    marginTop: 2, 
    zIndex: 2,
  },
  timelineCircleCompleted: { 
    backgroundColor: '#FF7A30' 
  },
  timelineLine: { 
    width: 3, 
    position: 'absolute', 
    left: 10, 
    top: 26, 
    bottom: -10, 
    backgroundColor: '#F0E5DC', 
    zIndex: 1 
  },
  timelineLineCompleted: { 
    backgroundColor: '#FF7A30' 
  },
  timelineContent: { 
    flex: 1, 
    justifyContent: 'center', 
    paddingBottom: 16 
  },
  timelineLabel: { 
    fontSize: 14, 
    color: '#B0A498', 
    fontWeight: '500' 
  },
  timelineLabelCompleted: { 
    color: '#3A2113', 
    fontWeight: '600', 
    fontSize: 15 
  },
  navSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    elevation: 1,
  },
  navSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3A2113',
    marginBottom: 10,
  },
  navButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  navBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  itemsCard: {
    marginHorizontal: 16, 
    marginBottom: 16, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16,
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#F5EBE1',
    shadowColor: '#3A2113', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 6, 
    elevation: 1,
  },
  itemsTitle: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#3A2113', 
    marginBottom: 10, 
    letterSpacing: 0.3 
  },
  dropoffRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#FFF3EB', 
    padding: 10, 
    borderRadius: 10, 
    marginBottom: 8 
  },
  dropoffText: { 
    fontSize: 13, 
    color: '#FF7A30', 
    fontWeight: '600' 
  },
  itemLine: { 
    fontSize: 14, 
    color: '#5C4638', 
    paddingVertical: 4 
  },
  divider: { 
    height: 1, 
    backgroundColor: '#F5EBE1', 
    marginVertical: 12 
  },
  itemsTotalRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  itemsTotalLabel: { 
    fontSize: 14, 
    color: '#8B7E74' 
  },
  itemsTotalValue: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#FF7A30' 
  },
  advanceBtn: {
    marginHorizontal: 16, 
    marginBottom: 16, 
    backgroundColor: '#FF7A30', 
    borderRadius: 14,
    paddingVertical: 16, 
    alignItems: 'center', 
    shadowColor: '#FF7A30', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    elevation: 3,
  },
  advanceBtnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  cancelBtn: {
    marginHorizontal: 16, 
    marginBottom: 16, 
    backgroundColor: '#E74C3C', 
    borderRadius: 14,
    paddingVertical: 16, 
    alignItems: 'center',
    shadowColor: '#E74C3C', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    elevation: 3,
  },
  cancelBtnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  qrSection: { 
    paddingHorizontal: 16, 
    marginBottom: 20, 
    gap: 12 
  },
  qrContainer: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: '#F5EBE1', 
    alignItems: 'center', 
    gap: 12 
  },
  qrBox: { 
    padding: 12, 
    backgroundColor: '#FFFBF7', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#EBDCD0' 
  },
  qrLabel: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#5C4638' 
  },
  qrHintText: { 
    fontSize: 12, 
    color: '#8B7E74', 
    textAlign: 'center', 
    lineHeight: 18 
  },
  regenerateButton: { 
    backgroundColor: '#FF7A30', 
    borderRadius: 14, 
    paddingVertical: 16, 
    alignItems: 'center' 
  },
  regenerateButtonText: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  codSection: { 
    marginHorizontal: 16, 
    marginBottom: 20, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16, 
    gap: 12, 
    borderWidth: 1, 
    borderColor: '#EBF3FC' 
  },
  codHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  codTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#2C3E50' 
  },
  codAmount: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 4 
  },
  codLabel: { 
    fontSize: 14, 
    color: '#7F8C8D' 
  },
  codValue: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#2ECC71' 
  },
  confirmButton: { 
    backgroundColor: '#2ECC71', 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: 'center' 
  },
  confirmButtonText: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  rateBtn: { 
    flexDirection: 'row', 
    gap: 8, 
    marginHorizontal: 16, 
    marginBottom: 20, 
    backgroundColor: '#FFB84D', 
    borderRadius: 14, 
    paddingVertical: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  rateBtnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 15 
  },
  riderSection: { 
    paddingHorizontal: 16, 
    marginBottom: 20 
  },
  riderCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    borderWidth: 1, 
    borderColor: '#F5EBE1' 
  },
  riderAvatar: { 
    width: 46, 
    height: 46, 
    borderRadius: 23, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  riderAvatarText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: 'bold' 
  },
  riderInfo: { 
    flex: 1 
  },
  riderName: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#3A2113' 
  },
  riderTrust: { 
    fontSize: 12, 
    color: '#8B7E74', 
    marginTop: 2 
  },
  messageButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#FFF3EB', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  spacer: { 
    height: 40 
  },
});