import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

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
  runner_id: string;
  otherPartyName: string;
  otherPartyTrust: number;
  items: { item_name: string; quantity: number }[];
  dropoffLabel: string | null;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string | undefined;

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
         requester:requester_id ( name, trust_scores ( trust_score ) ),
         runner:runner_id ( name, trust_scores ( trust_score ) ),
         order_items ( item_name, quantity ),
         dropoff:dropoff_id ( name ), custom_dropoff_label`
      )
      .eq('id', orderId)
      .single();

    if (!error && data) {
      const row = data as any;
      const iAmRunner = uid === row.runner_id;
      const other = iAmRunner ? row.requester : row.runner;
      setOrder({
        id: row.id,
        status: row.status,
        payment_mode: row.payment_mode,
        item_total: Number(row.item_total),
        fee: Number(row.fee),
        requester_id: row.requester_id,
        runner_id: row.runner_id,
        otherPartyName: other?.name || 'ไม่ทราบชื่อ',
        otherPartyTrust: other?.trust_scores?.[0]?.trust_score ?? 100,
        items: row.order_items || [],
        dropoffLabel: row.dropoff?.name || row.custom_dropoff_label || null,
      });
    }
    setLoading(false);
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder])
  );

  const isRunner = order && myUserId === order.runner_id;
  const isRequester = order && myUserId === order.requester_id;
  const currentStepIndex = order ? STEP_ORDER.indexOf(order.status) : -1;

  // ฟังก์ชันอัปเดตสถานะ
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

  // ฟังก์ชันยืนยันรับเงินสด COD
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

  // ฟังก์ชันยกเลิกออเดอร์
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

  // ฟังก์ชันส่งเรื่องร้องเรียนข้อพิพาท
  const handleSubmitDispute = async (reasonText: string) => {
    if (!order || !reasonText.trim()) return;

    const { error } = await supabase
      .from('dispute_reports')
      .insert({
        filed_by: myUserId,
        order_id: order.id,
        reason: reasonText,
        status: 'pending'
      });

    if (!error) {
      Alert.alert('ส่งรายงานแล้ว', 'ผู้ดูแลระบบจะทำการตรวจสอบข้อพิพาทนี้โดยเร็วที่สุด');
    }
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

        {/* Items */}
        <View style={styles.itemsCard}>
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

        {/* ปุ่มยกเลิกออเดอร์สำหรับฝากซื้อ (แสดงเมื่อสถานะยังรอตอบรับ) */}
        {isRequester && order.status === 'pending' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOrder} disabled={updating}>
            <Text style={styles.cancelBtnText}>ยกเลิกออเดอร์นี้</Text>
          </TouchableOpacity>
        )}

        {/* Runner action buttons (advance status) - อัปเดตส้มปลดล็อกให้วิ่งได้ทั้งคู่ยกเว้นสเต็ปท้าย COD */}
        {isRunner && currentStepIndex >= 0 && currentStepIndex < STEP_ORDER.length - 1 && !(order.payment_mode === 'cod' && order.status === 'delivering') && (
          <TouchableOpacity style={styles.advanceBtn} onPress={() => updateStatus(STEP_ORDER[currentStepIndex + 1])} disabled={updating}>
            {updating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.advanceBtnText}>อัปเดตเป็น: {STEP_LABELS[STEP_ORDER[currentStepIndex + 1]]}</Text>}
          </TouchableOpacity>
        )}

        {/* QR Code (Wallet mode) - สลับฝั่ง: ไรเดอร์โชว์ QR ให้ลูกค้าสแกน / ลูกค้ากดเปิดกล้องสแกน */}
        {order.payment_mode === 'wallet' && (
          <View style={styles.qrSection}>
            {isRunner ? (
              /* ฝั่งไรเดอร์ (Runner): แสดง QR Code ของออเดอร์ให้ลูกค้าสแกนยืนยันรับของ */
              <View style={styles.qrContainer}>
                <View style={styles.qrBox}>
                  <QRCode value={`CARRYBUDDY-ORDER-${order.id}`} size={140} color="#3A2113" backgroundColor="#FFFFFF" />
                </View>
                <Text style={styles.qrLabel}>QR สำหรับให้ลูกค้าสแกนรับของ (Order #{order.id})</Text>
                <Text style={styles.qrHintText}>ให้ลูกค้าสแกน QR นี้เมื่อนำส่งสินค้าถึงมือเพื่อจบงาน</Text>
              </View>
            ) : (
              /* ฝั่งลูกค้า (Requester): มีปุ่มเปิดกล้องสแกน QR ของไรเดอร์เพื่อยืนยันรับของ */
              <View style={styles.qrContainer}>
                <Text style={styles.qrLabel}>ยืนยันการรับสินค้า</Text>
                <TouchableOpacity 
                  style={styles.regenerateButton} 
                  onPress={() => router.push({ pathname: '/qr-scanner', params: { orderId: order.id } })}
                >
                  <Ionicons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.regenerateButtonText}>เปิดกล้องสแกน QR ของไรเดอร์</Text>
                </TouchableOpacity>
                <Text style={styles.qrHintText}>เมื่อได้รับสินค้าแล้ว กดปุ่มนี้เพื่อส่อง QR Code ของไรเดอร์</Text>
              </View>
            )}
          </View>
        )}

        {/* COD Settlement (Runner confirms cash received) - แสดงปุ่มเขียวเฉพาะตอนถึงขั้น delivering */}
        {order.payment_mode === 'cod' && isRunner && order.status === 'delivering' && (
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

        {order.status === 'completed' && isRequester && (
          <TouchableOpacity style={styles.rateBtn} onPress={() => router.push({ pathname: '/rate-rider', params: { orderId: order.id, runnerId: order.runner_id } })}>
            <Ionicons name="star" size={18} color="#FFFFFF" />
            <Text style={styles.rateBtnText}>ให้คะแนนผู้รับหิ้ว</Text>
          </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.messageButton}
              onPress={async () => {
                // หาห้องแชทเดิมของคู่นี้ หรือสร้างใหม่ถ้ายังไม่เคยคุยกันมาก่อน
                // (กันปัญหาห้องแชทซ้ำเวลามีออเดอร์ร่วมกันหลายครั้ง)
                const otherPartyId = isRunner ? order.requester_id : order.runner_id;
                const { data: conversationId, error } = await supabase.rpc('get_or_create_conversation', {
                  other_user_id: otherPartyId,
                });
                if (error || !conversationId) {
                  Alert.alert('เปิดแชทไม่สำเร็จ', error?.message ?? 'กรุณาลองใหม่อีกครั้ง');
                  return;
                }
                router.push({ pathname: '/chat-detail/[id]', params: { id: String(conversationId) } });
              }}
            >
              <Ionicons name="chatbubble" size={20} color="#FF7A30" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
    marginBottom: 12 
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