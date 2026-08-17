import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LocationPickerModal, PickedLocation } from '@/components/LocationPickerModal';
import { ItemListEditor, EditableItem, calcItemTotal } from '@/components/ItemListEditor';
import { ORDER_THEME } from '@/constants/OrderTheme';
import { ScreenHeader } from '@/components/ScreenHeader';

function locationLabel(loc: PickedLocation | null) {
  if (!loc) return null;
  return loc.type === 'preset' ? loc.name : loc.label;
}

export default function CreateOpenRequest() {
  const router = useRouter();
  const [store, setStore] = useState<PickedLocation | null>(null);
  const [dropoff, setDropoff] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState<'store' | 'dropoff' | null>(null);
  const [items, setItems] = useState<EditableItem[]>([{ name: '', quantity: '1', price: '' }]);
  const [offerFee, setOfferFee] = useState('15');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'wallet'>('cash_on_delivery');

  const itemTotal = calcItemTotal(items);

  const handleSubmit = async () => {
    if (submitting) return;

    if (!store || !dropoff) {
      Alert.alert('ไม่ครบ', 'กรุณาเลือกร้านต้นทางและจุดส่งปลายทาง');
      return;
    }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      Alert.alert('ไม่ครบ', 'กรุณาระบุรายการสินค้าอย่างน้อย 1 ชิ้น');
      return;
    }
    const fee = Number(offerFee) || 0;

    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSubmitting(false);
      return;
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        requester_id: userData.user.id,
        post_id: null,
        runner_id: null,
        
        store_id: store.type === 'preset' ? store.id : null,
        custom_store_lat: store.type === 'custom' ? store.lat : null,
        custom_store_lng: store.type === 'custom' ? store.lng : null,
        custom_store_label: store.type === 'custom' ? store.label : null,

        dropoff_id: dropoff.type === 'preset' ? dropoff.id : null,
        custom_dropoff_lat: dropoff.type === 'custom' ? dropoff.lat : null,
        custom_dropoff_lng: dropoff.type === 'custom' ? dropoff.lng : null,
        custom_dropoff_label: dropoff.type === 'custom' ? dropoff.label : null,

        payment_mode: paymentMethod === 'cash_on_delivery' ? 'cod' : 'wallet',
        item_total: itemTotal,
        fee,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !order) {
      setSubmitting(false);
      Alert.alert('โพสต์ไม่สำเร็จ', error?.message ?? 'ลองใหม่อีกครั้ง');
      return;
    }

    await supabase.from('order_items').insert(
      validItems.map((i) => ({
        order_id: order.id,
        item_name: i.name,
        quantity: Number(i.quantity) || 1,
        est_price: Number(i.price) || 0,
        note: note || null,
      }))
    );

    setSubmitting(false);
    Alert.alert('สำเร็จ', 'โพสต์คำขอฝากหิ้วแบบเปิดแล้ว รอ Runner มารับงาน', [
      { text: 'ไปหน้าหลัก', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 🛠️ ใช้ ScreenHeader กลาง แบบไม่มีแถบขาว เพื่อให้สอดคล้องกับหน้าอื่น */}
      <ScreenHeader title="โพสต์ฝากหิ้วแบบเปิด" subtitle="ยังไม่ต้องเลือกคนรับ รอใครสะดวกมากดรับงาน" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionCard}>
          <Text style={styles.label}>ร้าน/สถานที่ต้นทาง</Text>
          <TouchableOpacity style={styles.pickerField} onPress={() => setPickerOpen('store')} activeOpacity={0.8}>
            <Ionicons name={store?.type === 'custom' ? 'pin' : 'location'} size={18} color={ORDER_THEME.accent} />
            <Text style={[styles.pickerText, !store && styles.pickerPlaceholder]}>
              {locationLabel(store) || 'เลือกร้าน/สถานที่...'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={ORDER_THEME.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>จุดส่งของปลายทาง</Text>
          <TouchableOpacity style={styles.pickerField} onPress={() => setPickerOpen('dropoff')} activeOpacity={0.8}>
            <Ionicons name={dropoff?.type === 'custom' ? 'pin' : 'location'} size={18} color={ORDER_THEME.accent} />
            <Text style={[styles.pickerText, !dropoff && styles.pickerPlaceholder]}>
              {locationLabel(dropoff) || 'เลือกจุดส่งของ...'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={ORDER_THEME.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>รายการสินค้า</Text>
          <ItemListEditor items={items} onChange={setItems} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>หมายเหตุเพิ่มเติม (ไม่บังคับ)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="เช่น ไม่ใส่ผักชี, รอรับได้หลัง 5 โมงเย็น"
            placeholderTextColor={ORDER_THEME.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>ค่าหิ้วที่จะให้ (บาท)</Text>
          <TextInput
            style={styles.feeInput}
            keyboardType="decimal-pad"
            value={offerFee}
            onChangeText={setOfferFee}
          />
          <Text style={styles.feeHint}>ตั้งราคาเองได้ ยิ่งให้เยอะยิ่งมีคนรับเร็ว (แนะนำ 15-25฿)</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>วิธีการชำระเงิน</Text>
          <View style={styles.paymentRow}>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'cash_on_delivery' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('cash_on_delivery' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="wallet-outline" size={20} color={paymentMethod === 'cash_on_delivery' ? ORDER_THEME.accent : ORDER_THEME.textSecondary} />
              <Text style={[styles.paymentText, paymentMethod === 'cash_on_delivery' && styles.paymentTextActive]}>จ่ายปลายทาง</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'wallet' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('wallet')}
              activeOpacity={0.8}
            >
              <Ionicons name="card-outline" size={20} color={paymentMethod === 'wallet' ? ORDER_THEME.accent : ORDER_THEME.textSecondary} />
              <Text style={[styles.paymentText, paymentMethod === 'wallet' && styles.paymentTextActive]}>เป๋าเงินในแอป</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ค่าสินค้าโดยประมาณ</Text>
            <Text style={styles.summaryValue}>฿{itemTotal.toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ค่าหิ้ว</Text>
            <Text style={styles.summaryValue}>฿{(Number(offerFee) || 0).toFixed(0)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>รวมยอดมัดจำที่ล็อก</Text>
            <Text style={styles.totalValue}>฿{(itemTotal + (Number(offerFee) || 0)).toFixed(0)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>โพสต์คำขอฝากหิ้ว</Text>}
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      <LocationPickerModal visible={pickerOpen === 'store'} kind="store" onClose={() => setPickerOpen(null)} onSelect={setStore} />
      <LocationPickerModal visible={pickerOpen === 'dropoff'} kind="dropoff" onClose={() => setPickerOpen(null)} onSelect={setDropoff} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  sectionCard: {
    backgroundColor: ORDER_THEME.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    marginBottom: 12,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: ORDER_THEME.textPrimary,
    marginBottom: 8,
  },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ORDER_THEME.surfaceSoft,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerText: {
    flex: 1,
    fontSize: 14,
    color: ORDER_THEME.textPrimary,
    fontWeight: '600',
  },
  pickerPlaceholder: {
    color: ORDER_THEME.textMuted,
    fontWeight: '500',
  },
  noteInput: {
    backgroundColor: ORDER_THEME.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 13,
    color: ORDER_THEME.textPrimary,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  feeInput: {
    backgroundColor: ORDER_THEME.surfaceSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: 'bold',
    color: ORDER_THEME.textPrimary,
  },
  feeHint: {
    fontSize: 11,
    color: ORDER_THEME.textSecondary,
    marginTop: 6,
    fontWeight: '500',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORDER_THEME.surfaceSoft,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  paymentOptionActive: {
    borderColor: ORDER_THEME.accent,
    backgroundColor: ORDER_THEME.accentSoft,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: ORDER_THEME.textSecondary,
  },
  paymentTextActive: {
    color: ORDER_THEME.accent,
  },
  summaryBox: {
    backgroundColor: ORDER_THEME.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: ORDER_THEME.borderSoft,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10 
  },
  summaryLabel: { 
    fontSize: 13, 
    color: '#8B7E74',
    fontWeight: '500'
  },
  summaryValue: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#3A2113' 
  },
  divider: {
    height: 1,
    backgroundColor: ORDER_THEME.borderSoft,
    marginVertical: 6,
  },
  totalLabel: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#3A2113' 
  },
  totalValue: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#FF7A30' 
  },
  submitBtn: {
    backgroundColor: ORDER_THEME.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: ORDER_THEME.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    color: ORDER_THEME.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
});