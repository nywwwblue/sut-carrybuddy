import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LocationPickerModal, PickedLocation } from '@/components/LocationPickerModal';
import { ItemListEditor, EditableItem, calcItemTotal } from '@/components/ItemListEditor';
import { ScreenHeader } from '@/components/ScreenHeader';

function locationLabel(loc: PickedLocation | null) {
  if (!loc) return null;
  return loc.type === 'preset' ? loc.name : loc.label;
}

export default function FlashOrderForm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const flashPostId = params.flashPostId ? Number(params.flashPostId) : null;
  const storeNameParam = (params.storeName as string) || 'พิกัดร้านค้าด่วน';

  const [dropoff, setDropoff] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([{ name: '', quantity: '1', price: '' }]);
  const [note, setNote] = useState('');
  const [paymentMode, setPaymentMode] = useState<'wallet' | 'cod'>('wallet');
  const [submitting, setSubmitting] = useState(false);

  const itemTotal = calcItemTotal(items);
  const fixedFee = 15; // ค่าหิ้วด่วนมาตรฐาน

  const handleSubmitFlashOrder = async () => {
    if (!flashPostId) {
      Alert.alert('ผิดพลาด', 'ไม่พบรหัสบอร์ด Flash Buy กรุณาลองใหม่อีกครั้ง');
      return;
    }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาระบุรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }
    if (!dropoff) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาเลือกจุดส่งของปลายทาง');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        Alert.alert('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนทำการสั่งซื้อ');
        return;
      }

      // 1. บันทึกลงตาราง orders โดยผูก post_id ของ Flash Buy
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          requester_id: userData.user.id,
          post_id: flashPostId,
          fee: fixedFee,
          item_total: itemTotal,
          status: 'pending',
          payment_mode: paymentMode,
          dropoff_id: dropoff.type === 'preset' ? dropoff.id : null,
          custom_dropoff_label: dropoff.type === 'custom' ? dropoff.label : null,
          note: note.trim(),
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // 2. บันทึกรายการสินค้าลงตาราง order_items
      const orderItemsPayload = validItems.map(item => ({
        order_id: orderData.id,
        item_name: item.name.trim(),
        quantity: Number(item.quantity) || 1,
        est_price: Number(item.price) || 0,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload);
      if (itemsError) throw itemsError;

      Alert.alert('สำเร็จ', 'ส่งคำสั่งซื้อ Flash Buy สำเร็จแล้ว', [
        { text: 'ตกลง', onPress: () => router.replace('/(tabs)') }
      ]);

    } catch (err: any) {
      Alert.alert('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถส่งคำสั่งซื้อได้');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="สั่งซื้อด่วน Flash Buy" subtitle={`กำลังฝากซื้อจาก: ${storeNameParam}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentBox}>
        <Text style={styles.label}>รายการสินค้าที่ต้องการฝากซื้อ</Text>
        <ItemListEditor items={items} onChange={setItems} />

        <Text style={[styles.label, { marginTop: 20 }]}>ข้อความหมายเหตุถึงไรเดอร์</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="เช่น เอาหวานน้อย, ไม่ใส่ผัก, รีบใช้นะครับ"
          placeholderTextColor="#B0A498"
          value={note}
          onChangeText={setNote}
          multiline
        />

        <Text style={[styles.label, { marginTop: 20 }]}>จุดรับของปลายทาง (หอพัก/ตึกเรียน มทส.)</Text>
        <TouchableOpacity style={styles.pickerField} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
          <Ionicons name={dropoff?.type === 'custom' ? 'pin' : 'location'} size={18} color="#FF7A30" />
          <Text style={[styles.pickerText, !dropoff && styles.pickerPlaceholder]}>
            {locationLabel(dropoff) || 'กดเพื่อเลือกจุดส่งของ...'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#8B7E74" />
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: 20 }]}>ช่องทางการชำระเงิน</Text>
        <View style={styles.paymentContainer}>
          <TouchableOpacity 
            style={[styles.paymentBtn, paymentMode === 'wallet' && styles.paymentBtnActive]}
            onPress={() => setPaymentMode('wallet')}
            activeOpacity={0.8}
          >
            <Ionicons name="wallet-outline" size={20} color={paymentMode === 'wallet' ? '#FFFFFF' : '#8B7E74'} />
            <Text style={[styles.paymentText, paymentMode === 'wallet' && styles.paymentTextActive]}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.paymentBtn, paymentMode === 'cod' && styles.paymentBtnActive]}
            onPress={() => setPaymentMode('cod')}
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={20} color={paymentMode === 'cod' ? '#FFFFFF' : '#8B7E74'} />
            <Text style={[styles.paymentText, paymentMode === 'cod' && styles.paymentTextActive]}>เงินสด (COD)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.feeBox}>
          <View>
            <Text style={styles.feeLabel}>ค่าหิ้วด่วน Flash Buy</Text>
            <Text style={styles.feeAmount}>฿{fixedFee.toFixed(0)}</Text>
          </View>
          <Ionicons name="flash" size={26} color="#FFFFFF" />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitFlashOrder} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>ยืนยันการสั่งซื้อด่วนทันที</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <LocationPickerModal
        visible={pickerOpen}
        kind="dropoff"
        onClose={() => setPickerOpen(false)}
        onSelect={setDropoff}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  contentBox: { padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#3A2113', marginBottom: 8, letterSpacing: 0.1 },
  noteInput: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#3A2113', borderWidth: 1, borderColor: '#F5EBE1', minHeight: 64, textAlignVertical: 'top',
  },
  pickerField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#F5EBE1', shadowColor: '#3A2113', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1
  },
  pickerText: { flex: 1, fontSize: 14, color: '#3A2113', fontWeight: '600' },
  pickerPlaceholder: { color: '#FF7A30', fontWeight: '600' },
  paymentContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F5EBE1',
  },
  paymentBtnActive: {
    backgroundColor: '#FF7A30',
    borderColor: '#FF7A30',
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B7E74',
  },
  paymentTextActive: {
    color: '#FFFFFF',
  },
  feeBox: {
    backgroundColor: '#FF7A30', borderRadius: 16, padding: 18, marginTop: 24, marginBottom: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#FF7A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2
  },
  feeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500' },
  feeAmount: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', marginTop: 2 },
  submitBtn: {
    backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#FF7A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});