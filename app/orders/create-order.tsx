import React, { useState, useEffect } from 'react';
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

export default function CreateOrder() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = params.postId as string | undefined;
  const runnerId = params.runnerId as string | undefined;
  const fee = params.fee ? Number(params.fee) : 15;

  const [locationName, setLocationName] = useState('กำลังโหลดพิกัด...');
  const [dropoff, setDropoff] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([{ name: '', quantity: '1', price: '' }]);
  const [note, setNote] = useState('');
  const [fetchingPost, setFetchingPost] = useState(true);

  const itemTotal = calcItemTotal(items);

  // ดึงหัวข้อสถานที่ต้นทางจากประกาศโพสต์ (รองรับทั้ง Custom Label และ Preset ID)
  useEffect(() => {
    if (!postId) return;
    supabase
      .from('runner_posts')
      .select('custom_origin_label, store:store_id ( name )')
      .eq('id', postId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const row = data as any;
          setLocationName(row.custom_origin_label || row.store?.name || 'พิกัดร้านค้าด่วน');
        } else {
          setLocationName('ร้านค้าพิกัดทั่วไป');
        }
        setFetchingPost(false);
      });
  }, [postId]);

  const handleSubmit = () => {
    if (!postId || !runnerId) {
      Alert.alert('ผิดพลาด', 'ไม่พบผู้รับหิ้วที่เลือก กรุณากลับไปเลือกโพสต์รับหิ้วก่อน');
      return;
    }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      Alert.alert('ไม่ครบ', 'กรุณาระบุรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }
    if (!dropoff) {
      Alert.alert('ไม่ครบ', 'กรุณาเลือกจุดส่งของส่วนกลาง');
      return;
    }

    router.push({
      pathname: '/payment/checkout',
      params: {
        postId,
        runnerId,
        dropoffId: dropoff.type === 'preset' ? dropoff.id : '',
        customDropoff: dropoff.type === 'custom' ? JSON.stringify(dropoff) : '',
        fee: String(fee),
        itemTotal: String(itemTotal),
        note,
        items: JSON.stringify(validItems),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
        <ScreenHeader 
          title="สร้างคำขอฝากหิ้ว" 
          subtitle={fetchingPost ? "กำลังโหลด..." : `ฝากซื้อของจากพิกัด: ${locationName}`} 
        />

        <Text style={styles.label}>รายการสินค้าฝากซื้อ</Text>
        <ItemListEditor items={items} onChange={setItems} />

        <Text style={[styles.label, { marginTop: 20 }]}>ข้อความหมายเหตุถึงผู้รับหิ้ว</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="เช่น ไม่ใส่ผักชี, เผ็ดน้อย, เลือกชิ้นที่หมดอายุยาว ๆ"
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

        <View style={styles.feeBox}>
          <View>
            <Text style={styles.feeLabel}>ค่าหิ้วคำนวณตามจริง (Rule-based)</Text>
            <Text style={styles.feeAmount}>฿{fee.toFixed(0)}</Text>
          </View>
          <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>ตรวจสอบและชำระเงินมัดจำ</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
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