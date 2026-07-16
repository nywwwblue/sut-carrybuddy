import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

const COD_LIMIT = 200;

export default function Checkout() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const postId = params.postId ? Number(params.postId) : null;
  const runnerId = params.runnerId as string | undefined;
  const dropoffId = params.dropoffId ? Number(params.dropoffId) : null;
  const customDropoff: { lat: number; lng: number; label: string } | null = params.customDropoff
    ? JSON.parse(params.customDropoff as string)
    : null;
  const fee = Number(params.fee || 0);
  const itemTotal = Number(params.itemTotal || 0);
  const note = (params.note as string) || '';
  const items: { name: string; quantity: string; price: string }[] = params.items
    ? JSON.parse(params.items as string)
    : [];

  const [paymentMode, setPaymentMode] = useState<'wallet' | 'cod'>('wallet');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = itemTotal + fee;

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from('wallets')
        .select('available_balance')
        .eq('user_id', data.user.id)
        .single()
        .then(({ data: wallet }) => {
          if (wallet) setWalletBalance(Number(wallet.available_balance));
        });
    });
  }, []);

  const handleConfirm = async () => {
    if (!postId || !runnerId) {
      Alert.alert('ผิดพลาด', 'ไม่พบข้อมูลออเดอร์ กรุณาย้อนกลับไปเริ่มใหม่');
      return;
    }
    if (paymentMode === 'cod' && total > COD_LIMIT) {
      Alert.alert('เกินวงเงิน COD', `ออเดอร์ชำระปลายทางได้ไม่เกิน ฿${COD_LIMIT} กรุณาเลือกชำระผ่าน Wallet แทน`);
      return;
    }
    if (paymentMode === 'wallet' && walletBalance !== null && walletBalance < total) {
      Alert.alert('เงินใน Wallet ไม่พอ', `ยอดคงเหลือ ฿${walletBalance.toFixed(2)} แต่ต้องใช้ ฿${total.toFixed(2)}`);
      return;
    }

    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSubmitting(false);
      return;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        post_id: postId,
        requester_id: userData.user.id,
        runner_id: runnerId,
        payment_mode: paymentMode,
        item_total: itemTotal,
        fee,
        status: 'pending',
        dropoff_id: dropoffId,
        custom_dropoff_lat: customDropoff?.lat ?? null,
        custom_dropoff_lng: customDropoff?.lng ?? null,
        custom_dropoff_label: customDropoff?.label ?? null,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      setSubmitting(false);
      Alert.alert('สั่งซื้อไม่สำเร็จ', orderError?.message ?? 'ลองใหม่อีกครั้ง');
      return;
    }

    if (items.length > 0) {
      await supabase.from('order_items').insert(
        items.map((i) => ({
          order_id: order.id,
          item_name: i.name,
          quantity: Number(i.quantity) || 1,
          est_price: Number(i.price) || 0,
          note: note || null,
        }))
      );
    }

    if (paymentMode === 'wallet') {
      try {
        // เรียก RPC หลังบ้านจัดการโยกเงินมัดจำเข้า Escrow อย่างปลอดภัย
        const { error: escrowError } = await supabase.rpc('lock_order_escrow', {
          p_order_id: order.id,
          p_total_amount: total
        });
        
        if (escrowError) throw escrowError;
      } catch (err: any) {
        setSubmitting(false);
        Alert.alert('ทำรายการเงินไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดในการตัดเงิน');
        return;
      }
    }

    // เขียนสถานะออเดอร์ลงล็อกล็อกประวัติตามปกติ
    await supabase.from('order_status_logs').insert({
      order_id: order.id,
      changed_by: userData.user.id,
      status: 'pending',
      note: 'สร้างออเดอร์และยืนยันการชำระเงินแล้ว',
    });

    setSubmitting(false);
    router.replace({ pathname: '/orders/order-detail', params: { orderId: order.id } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        <ScreenHeader title="เลือกวิธีชำระเงิน" />

        {/* In-App Wallet */}
        <TouchableOpacity
          style={[styles.paymentCard, paymentMode === 'wallet' && styles.paymentCardActive]}
          onPress={() => setPaymentMode('wallet')}
        >
          <View style={styles.paymentIconBox}>
            <Ionicons name="wallet" size={22} color="#FF7A30" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.paymentTitle}>In-App Wallet</Text>
            <Text style={styles.paymentDesc}>ระบบล็อกเงินมัดจำ ปลดล็อกเมื่อรับของแล้ว</Text>
            <Text style={styles.paymentBalance}>
              ยอดคงเหลือ ฿{walletBalance !== null ? walletBalance.toFixed(2) : '...'}
            </Text>
          </View>
          <Ionicons
            name={paymentMode === 'wallet' ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={paymentMode === 'wallet' ? '#FF7A30' : '#D9CFC5'}
          />
        </TouchableOpacity>

        {/* COD */}
        <TouchableOpacity
          style={[styles.paymentCard, paymentMode === 'cod' && styles.paymentCardActive]}
          onPress={() => setPaymentMode('cod')}
        >
          <View style={styles.paymentIconBox}>
            <Ionicons name="cash" size={22} color="#FF7A30" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.paymentTitle}>ชำระปลายทาง COD</Text>
            <Text style={styles.paymentDesc}>จ่ายเงินสดตอนรับสินค้า</Text>
            <Text style={styles.paymentLimit}>จำกัดไม่เกิน {COD_LIMIT}฿</Text>
          </View>
          <Ionicons
            name={paymentMode === 'cod' ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={paymentMode === 'cod' ? '#FF7A30' : '#D9CFC5'}
          />
        </TouchableOpacity>

        {/* Order Summary */}
        <Text style={styles.summaryTitle}>สรุปออเดอร์</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>สินค้า</Text>
            <Text style={styles.summaryValue}>{itemTotal.toFixed(0)}฿</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ค่าหิ้ว</Text>
            <Text style={styles.summaryValue}>{fee.toFixed(0)}฿</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>รวม</Text>
            <Text style={styles.totalValue}>{total.toFixed(0)}฿</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleConfirm} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>ยืนยันการสั่งซื้อ</Text>}
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#3A2113' },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E8D5C4',
  },
  paymentCardActive: { borderColor: '#FF7A30', borderWidth: 1.5, backgroundColor: '#FFFBF5' },
  paymentIconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFE8D6',
    alignItems: 'center', justifyContent: 'center',
  },
  paymentTitle: { fontSize: 14, fontWeight: 'bold', color: '#3A2113' },
  paymentDesc: { fontSize: 11, color: '#8B7E74', marginTop: 2 },
  paymentBalance: { fontSize: 12, color: '#FF7A30', fontWeight: '700', marginTop: 4 },
  paymentLimit: { fontSize: 12, color: '#E74C3C', fontWeight: '700', marginTop: 4 },
  summaryTitle: { fontSize: 15, fontWeight: 'bold', color: '#3A2113', marginTop: 16, marginBottom: 10 },
  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E8D5C4',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: '#8B7E74' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#3A2113' },
  divider: { height: 1, backgroundColor: '#F0E6DC', marginVertical: 4 },
  totalLabel: { fontSize: 15, fontWeight: 'bold', color: '#3A2113' },
  totalValue: { fontSize: 17, fontWeight: 'bold', color: '#FF7A30' },
  submitBtn: { backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});
