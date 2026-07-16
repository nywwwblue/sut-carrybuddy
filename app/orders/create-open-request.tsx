import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LocationPickerModal, PickedLocation } from '@/components/LocationPickerModal';
import { ItemListEditor, EditableItem, calcItemTotal } from '@/components/ItemListEditor';

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

  const itemTotal = calcItemTotal(items);

  const handleSubmit = async () => {
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
        dropoff_id: dropoff.type === 'preset' ? dropoff.id : null,
        custom_dropoff_lat: dropoff.type === 'custom' ? dropoff.lat : null,
        custom_dropoff_lng: dropoff.type === 'custom' ? dropoff.lng : null,
        custom_dropoff_label: dropoff.type === 'custom' ? dropoff.label : null,
        payment_mode: 'wallet',
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
      <View style={styles.headerBox}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#3A2113" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>โพสต์ฝากหิ้วแบบเปิด</Text>
          <Text style={styles.headerSubtitle}>ยังไม่ต้องเลือกคนรับ รอใครสะดวกมากดรับงาน</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>ร้าน/สถานที่ต้นทาง</Text>
        <TouchableOpacity style={styles.pickerField} onPress={() => setPickerOpen('store')} activeOpacity={0.8}>
          <Ionicons name={store?.type === 'custom' ? 'pin' : 'location'} size={18} color="#FF7A30" />
          <Text style={[styles.pickerText, !store && styles.pickerPlaceholder]}>
            {locationLabel(store) || 'เลือกร้าน/สถานที่...'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
        </TouchableOpacity>

        <View style={{ marginTop: 16, marginBottom: 16 }}>
          <Text style={styles.label}>จุดส่งของปลายทาง</Text>
          <TouchableOpacity style={styles.pickerField} onPress={() => setPickerOpen('dropoff')} activeOpacity={0.8}>
            <Ionicons name={dropoff?.type === 'custom' ? 'pin' : 'location'} size={18} color="#FF7A30" />
            <Text style={[styles.pickerText, !dropoff && styles.pickerPlaceholder]}>
              {locationLabel(dropoff) || 'เลือกจุดส่งของ...'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>รายการสินค้า</Text>
        <ItemListEditor items={items} onChange={setItems} />

        <Text style={[styles.label, { marginTop: 16 }]}>หมายเหตุเพิ่มเติม (ไม่บังคับ)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="เช่น ไม่ใส่ผักชี, รอรับได้หลัง 5 โมงเย็น"
          placeholderTextColor="#B0A498"
          value={note}
          onChangeText={setNote}
          multiline
        />

        <Text style={[styles.label, { marginTop: 16 }]}>ค่าหิ้วที่จะให้ (บาท)</Text>
        <TextInput
          style={styles.feeInput}
          keyboardType="decimal-pad"
          value={offerFee}
          onChangeText={setOfferFee}
        />
        <Text style={styles.feeHint}>ตั้งราคาเองได้ ยิ่งให้เยอะยิ่งมีคนรับเร็ว (แนะนำ 15-25฿)</Text>

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
    backgroundColor: '#FFFBF7' 
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F5EBE1',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8B7E74',
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
  },
  label: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#3A2113', 
    marginBottom: 8 
  },
  pickerField: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#F5EBE1',
    borderRadius: 14, 
    paddingHorizontal: 14, 
    paddingVertical: 14,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  pickerText: { 
    flex: 1, 
    fontSize: 14, 
    color: '#3A2113', 
    fontWeight: '600' 
  },
  pickerPlaceholder: { 
    color: '#B0A498', 
    fontWeight: '500' 
  },
  noteInput: {
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    paddingHorizontal: 14, 
    paddingVertical: 14,
    fontSize: 13, 
    color: '#3A2113', 
    borderWidth: 1, 
    borderColor: '#F5EBE1',
    minHeight: 70, 
    textAlignVertical: 'top',
  },
  feeInput: {
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#F5EBE1',
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#3A2113',
  },
  feeHint: { 
    fontSize: 11, 
    color: '#8B7E74', 
    marginTop: 6,
    fontWeight: '500'
  },
  summaryBox: {
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16, 
    marginTop: 20, 
    borderWidth: 1, 
    borderColor: '#F5EBE1',
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
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
    backgroundColor: '#F5EBE1', 
    marginVertical: 6 
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
    backgroundColor: '#FF7A30', 
    borderRadius: 14, 
    paddingVertical: 16, 
    alignItems: 'center', 
    marginTop: 24,
    shadowColor: '#FF7A30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
});