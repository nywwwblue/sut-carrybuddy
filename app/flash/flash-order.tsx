import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ItemListEditor, EditableItem, calcItemTotal } from '@/components/ItemListEditor';
import { ORDER_THEME } from '@/constants/OrderTheme';

const COD_LIMIT = 200;

interface FlashPostDetail {
  id: number;
  runner_id: string;
  runner_name: string;
  store_id: number | null;
  store_name: string;
  fee_per_order: number;
  max_orders: number;
}

interface DropoffLocation {
  id: number;
  name: string;
  zone?: string;
}

export default function FlashOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const flashPostId = params.flashPostId ? Number(params.flashPostId) : null;

  const [postDetail, setPostDetail] = useState<FlashPostDetail | null>(null);
  const [dropoffLocations, setDropoffLocations] = useState<DropoffLocation[]>([]);
  const [selectedDropoffId, setSelectedDropoffId] = useState<number | null>(null);
  const [customDropoffLabel, setCustomDropoffLabel] = useState('');

  const [items, setItems] = useState<EditableItem[]>([{ name: '', quantity: '1', price: '' }]);
  const [note, setNote] = useState('');
  
  const [paymentMode, setPaymentMode] = useState<'wallet' | 'cod'>('wallet');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const itemTotal = calcItemTotal(items);
  const total = itemTotal + (postDetail?.fee_per_order || 0);

  // ดึงข้อมูลโพสต์ด่วน สถานที่จัดส่ง และยอดเงินใน Wallet
  const loadData = useCallback(async () => {
    if (!flashPostId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('available_balance')
          .eq('user_id', userData.user.id)
          .single();
        if (wallet) setWalletBalance(Number(wallet.available_balance));
      }

      // โหลดข้อมูลโพสต์
      const { data: postData, error: postError } = await supabase
        .from('runner_posts')
        .select(`
          id, runner_id, fee_per_order, max_orders,
          runner:runner_id ( name ),
          store:store_id ( name ),
          custom_origin_label
        `)
        .eq('id', flashPostId)
        .single();

      if (!postError && postData) {
        const raw = postData as any;
        setPostDetail({
          id: raw.id,
          runner_id: raw.runner_id,
          runner_name: raw.runner?.name || 'Runner มทส.',
          store_id: raw.store_id,
          store_name: raw.store?.name || raw.custom_origin_label || 'ร้านค้า มทส.',
          fee_per_order: raw.fee_per_order || 15,
          max_orders: raw.max_orders || 5,
        });
      }

      // โหลดจุดส่งของยอดฮิตใน มทส.
      const { data: dropoffData } = await supabase
        .from('dropoff_locations')
        .select('id, name, zone')
        .eq('is_active', true)
        .limit(8);

      if (dropoffData) {
        setDropoffLocations(dropoffData as DropoffLocation[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [flashPostId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleConfirmOrder = async () => {
    if (submitting) return;

    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกรายการสินค้าอย่างน้อย 1 อย่างครับ');
      return;
    }
    if (!selectedDropoffId && !customDropoffLabel.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาเลือกหรือระบุจุดส่งของปลายทางของคุณ');
      return;
    }

    // คำนวณยอดเงินสดๆ ณ ตอนกดปุ่ม เพื่อความแม่นยำสูงสุด
    const currentItemTotal = calcItemTotal(items);
    const currentFee = postDetail?.fee_per_order || 0;
    const calculatedTotal = currentItemTotal + currentFee;
    const currentWalletBalance = walletBalance !== null ? Number(walletBalance) : 0;

    if (paymentMode === 'cod' && calculatedTotal > COD_LIMIT) {
      Alert.alert('เกินวงเงิน COD', `ออเดอร์ชำระปลายทางได้ไม่เกิน ฿${COD_LIMIT} กรุณาเลือกชำระผ่าน Wallet แทน`);
      return;
    }
    
    // ตรวจสอบยอดเงิน Wallet 
    if (paymentMode === 'wallet' && currentWalletBalance < calculatedTotal) {
      Alert.alert('เงินใน Wallet ไม่พอ', `ยอดคงเหลือ ฿${currentWalletBalance.toFixed(2)} แต่ต้องใช้ ฿${calculatedTotal.toFixed(2)}`);
      return;
    }

    if (!postDetail) return;

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // 1. สร้างออเดอร์สถานะ pending เพื่อให้ระบบล็อกเงิน escrow ได้ถูกต้อง
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          requester_id: userData.user.id,
          post_id: postDetail.id,
          runner_id: postDetail.runner_id,
          store_id: postDetail.store_id,
          payment_mode: paymentMode,
          item_total: currentItemTotal,
          fee: currentFee,
          status: 'pending',
          dropoff_id: selectedDropoffId,
          custom_dropoff_label: selectedDropoffId ? null : customDropoffLabel.trim(),
        })
        .select('id')
        .single();

      if (orderError || !orderData) throw orderError ?? new Error('ไม่สามารถสร้างออเดอร์ได้');

      try {
        // 2. ถ้าเลือก Wallet ให้ทำการล็อกเงินมัดจำ
        if (paymentMode === 'wallet') {
          const { error: escrowError } = await supabase.rpc('lock_order_escrow', {
            p_order_id: orderData.id,
            p_total_amount: calculatedTotal,
          });
          if (escrowError) throw escrowError;
        }

        // 3. บันทึกรายการสินค้า
        const { error: itemsError } = await supabase.from('order_items').insert(
          validItems.map((i) => ({
            order_id: orderData.id,
            item_name: i.name,
            quantity: Number(i.quantity) || 1,
            est_price: Number(i.price) || 0,
            note: note || null,
          }))
        );

        if (itemsError) throw itemsError;

        // 4. บันทึก Log สถานะ
        await supabase.from('order_status_logs').insert({
          order_id: orderData.id,
          changed_by: userData.user.id,
          status: 'pending',
          note: 'สร้างคำขอจาก Flash Buy และยืนยันการชำระเงินแล้ว',
        });
      } catch (err: any) {
        await supabase.from('orders').delete().eq('id', orderData.id);
        throw err;
      }

      Alert.alert('เข้าร่วมสำเร็จ', 'ส่งรายการสินค้าไปยังผู้รับหิ้วเรียบร้อยแล้ว!', [
        { text: 'ดูออเดอร์', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (err: any) {
      Alert.alert('สั่งซื้อไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#FF7A30" />
      </SafeAreaView>
    );
  }

  if (!postDetail) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>ไม่พบข้อมูลเซสชันด่วนนี้ หรืออาจหมดเวลา 5 นาทีแล้ว</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>กลับหน้าหลัก</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBox}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#3A2113" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>สั่งซื้อด่วนร่วมกับกลุ่ม</Text>
          <Text style={styles.headerSubtitle}>สั่งฝากหิ้วจากร้านเดียวกับที่ไรเดอร์กำลังจะไป</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ข้อมูลร้านค้าและไรเดอร์ */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="storefront" size={20} color="#FF7A30" />
            </View>
            <View style={styles.textData}>
              <Text style={styles.cardLabel}>ร้านค้าต้นทาง</Text>
              <Text style={styles.cardValue}>{postDetail.store_name}</Text>
            </View>
          </View>
          
          <View style={[styles.infoRow, { marginTop: 14 }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="person" size={20} color="#FF7A30" />
            </View>
            <View style={styles.textData}>
              <Text style={styles.cardLabel}>ผู้รับหิ้ว (Runner)</Text>
              <Text style={styles.cardValue}>{postDetail.runner_name}</Text>
            </View>
          </View>
        </View>

        {/* เลือกจุดส่งของปลายทาง (Dropoff) */}
        <Text style={styles.sectionLabel}>เลือกจุดส่งของปลายทาง (Dropoff)</Text>
        <TextInput
          style={styles.locationInput}
          placeholder="พิมพ์ระบุจุดส่งเอง เช่น หอพักสุรนิเวศ 16..."
          placeholderTextColor="#B0A498"
          value={customDropoffLabel}
          onChangeText={(text) => {
            setCustomDropoffLabel(text);
            setSelectedDropoffId(null);
          }}
        />
        <View style={styles.chipGrid}>
          {dropoffLocations.map((loc) => {
            const isSelected = selectedDropoffId === loc.id;
            return (
              <TouchableOpacity
                key={loc.id}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => {
                  setSelectedDropoffId(loc.id);
                  setCustomDropoffLabel(loc.name);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {loc.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* เลือกวิธีชำระเงิน */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>เลือกวิธีชำระเงิน</Text>
        <View style={styles.paymentRow}>
          <TouchableOpacity
            style={[styles.paymentCard, paymentMode === 'wallet' && styles.paymentCardActive]}
            onPress={() => setPaymentMode('wallet')}
          >
            <Ionicons name="wallet" size={20} color="#FF7A30" />
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>In-App Wallet</Text>
              <Text style={styles.paymentDesc}>ยอดคงเหลือ ฿{walletBalance !== null ? walletBalance.toFixed(2) : '...'}</Text>
            </View>
            <Ionicons name={paymentMode === 'wallet' ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={paymentMode === 'wallet' ? '#FF7A30' : '#D9CFC5'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentCard, paymentMode === 'cod' && styles.paymentCardActive]}
            onPress={() => setPaymentMode('cod')}
          >
            <Ionicons name="cash" size={20} color="#FF7A30" />
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>ชำระปลายทาง COD</Text>
              <Text style={styles.paymentDesc}>ไม่เกิน ฿{COD_LIMIT}</Text>
            </View>
            <Ionicons name={paymentMode === 'cod' ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={paymentMode === 'cod' ? '#FF7A30' : '#D9CFC5'} />
          </TouchableOpacity>
        </View>

        {/* รายการสินค้า */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>รายการสินค้าที่คุณต้องการสั่ง</Text>
        <ItemListEditor items={items} onChange={setItems} />

        {/* หมายเหตุ */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>หมายเหตุถึงไรเดอร์ (ไม่บังคับ)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="เช่น เพิ่มเผ็ด, แยกน้ำแข็ง หรือรายละเอียดระบุชัดเจน"
          placeholderTextColor="#B0A498"
          value={note}
          onChangeText={setNote}
          multiline
        />

        {/* สรุปยอดเงิน */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>รวมราคาสินค้าโดยประมาณ</Text>
            <Text style={styles.summaryValue}>฿{itemTotal.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ค่าหิ้วด่วนคงที่ (ตามโพสต์)</Text>
            <Text style={styles.summaryValue}>฿{postDetail.fee_per_order.toFixed(0)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>ยอดรวมทั้งสิ้น</Text>
            <Text style={styles.totalValue}>฿{total.toFixed(0)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleConfirmOrder} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>ยืนยันร่วมส่งคำขอ</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F5EBE1', gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF3EB', alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#3A2113' },
  headerSubtitle: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  scrollContent: { padding: 20 },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F5EBE1', marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3EB', alignItems: 'center', justifyContent: 'center' },
  textData: { flex: 1 },
  cardLabel: { fontSize: 11, color: '#8B7E74', fontWeight: '600' },
  cardValue: { fontSize: 14, fontWeight: 'bold', color: '#3A2113', marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#3A2113', marginBottom: 8 },
  locationInput: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#3A2113', borderWidth: 1, borderColor: '#F5EBE1', marginBottom: 10 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8D5C4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#FFF3EB', borderColor: '#FF7A30' },
  chipText: { fontSize: 12, color: '#3A2113', fontWeight: '600' },
  chipTextActive: { color: '#FF7A30', fontWeight: '700' },
  paymentRow: { flexDirection: 'row', gap: 10 },
  paymentCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F5EBE1', gap: 6 },
  paymentCardActive: { borderColor: '#FF7A30', borderWidth: 1.5, backgroundColor: '#FFF3EB' },
  paymentTitle: { fontSize: 13, fontWeight: 'bold', color: '#3A2113' },
  paymentDesc: { fontSize: 11, color: '#8B7E74' },
  noteInput: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#3A2113', borderWidth: 1, borderColor: '#F5EBE1', minHeight: 65, textAlignVertical: 'top' },
  summaryBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F5EBE1', marginTop: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: '#8B7E74', fontWeight: '500' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#3A2113' },
  divider: { height: 1, backgroundColor: '#F5EBE1', marginVertical: 6 },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: '#3A2113' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#FF7A30' },
  submitBtn: { backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: '#FF7A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  errorText: { fontSize: 14, color: '#8B7E74', textAlign: 'center', fontWeight: '500' },
  backLink: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFF3EB', borderRadius: 10 },
  backLinkText: { color: '#FF7A30', fontWeight: '700', fontSize: 13 },
});