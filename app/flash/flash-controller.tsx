import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LocationPickerModal, PickedLocation } from '@/components/LocationPickerModal';

function locationLabel(loc: PickedLocation | null) {
  if (!loc) return null;
  return loc.type === 'preset' ? loc.name : loc.label;
}

function LocationField({ title, placeholder, value, onPress }: { title: string; placeholder: string; value: PickedLocation | null; onPress: () => void }) {
  const label = locationLabel(value);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.cardQuestion}>{title}</Text>
      <TouchableOpacity style={styles.pickerField} onPress={onPress} activeOpacity={0.8}>
        <Ionicons name={value?.type === 'custom' ? 'pin' : 'location'} size={18} color="#FF7A30" />
        <Text style={[styles.pickerText, !label && styles.pickerPlaceholder]}>{label || placeholder}</Text>
        <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
      </TouchableOpacity>
    </View>
  );
}

export default function FlashControllerScreen() {
  const router = useRouter();
  
  const [selectedStore, setSelectedStore] = useState<PickedLocation | null>(null);
  const [selectedDropoff, setSelectedDropoff] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState<'store' | 'dropoff' | null>(null);

  const [routePassText, setRoutePassText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenFlashBuy = async () => {
    if (submitting) return;

    if (!selectedStore) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาเลือกร้านค้าต้นทางที่จะไปซื้อของครับ');
      return;
    }
    if (!selectedDropoff) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาระบุจุดหมายปลายทางที่จะไปส่งของครับ');
      return;
    }
    if (!routePassText.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาระบุเส้นทางหรือจุดที่จะขับผ่าน (เช่น ผ่านสุรนิเวศ 16)');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // 1. สร้างโพสต์หลักฝั่ง runner_posts พร้อมรองรับทั้งแบบ Preset และ Custom Map
      const { data: postData, error: postError } = await supabase
        .from('runner_posts')
        .insert({
          runner_id: userData.user.id,
          store_id: selectedStore.type === 'preset' ? selectedStore.id : null,
          dropoff_id: selectedDropoff.type === 'preset' ? selectedDropoff.id : null,
          custom_origin_lat: selectedStore.type === 'custom' ? selectedStore.lat : null,
          custom_origin_lng: selectedStore.type === 'custom' ? selectedStore.lng : null,
          custom_origin_label: selectedStore.type === 'custom' ? selectedStore.label : null,
          custom_route_pass: routePassText.trim(),
          post_type: 'flash',
          max_orders: 5,
          fee_per_order: 15,
          status: 'open',
        })
        .select('id')
        .single();

      if (postError) throw postError;

      // 2. บันทึกเซสชันลงตาราง flash_buy_sessions เพื่อเปิดให้ฝั่งคนซื้อเห็นป้ายแบนเนอร์เรียลไทม์
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: sessionError } = await supabase
        .from('flash_buy_sessions')
        .insert({
          runner_id: userData.user.id,
          store_id: selectedStore.type === 'preset' ? selectedStore.id : null,
          post_id: postData.id,
          custom_location_label: selectedStore.type === 'custom' ? selectedStore.label : null,
          expires_at: expiresAt,
          status: 'active',
        });

      if (sessionError) throw sessionError;

      router.push({
        pathname: '/flash/flash-live' as any,
        params: { postId: postData.id, routePass: routePassText.trim() }
      });
    } catch (err: any) {
      Alert.alert('เปิดบอร์ดไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดทางเทคนิค');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBox}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#3A2113" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>โหมดเปิดรับคำขอด่วน (Flash Buy)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentBox} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* 1. เลือกสถานที่ต้นทาง */}
          <LocationField
            title="1. คุณกำลังจะเดินทางไปซื้อของที่ไหน?"
            placeholder="เลือกพิกัดร้านค้า/โรงอาหาร..."
            value={selectedStore}
            onPress={() => setPickerOpen('store')}
          />

          {/* 2. เลือกสถานที่ปลายทาง */}
          <LocationField
            title="2. จุดหมายปลายทางหลักที่คุณจะไปส่งคือที่ไหน?"
            placeholder="เลือกตึก/หอพักที่สะดวกนำส่ง..."
            value={selectedDropoff}
            onPress={() => setPickerOpen('dropoff')}
          />

          {/* 3. ระบุเส้นทางผ่าน */}
          <Text style={[styles.cardQuestion, { marginTop: 8 }]}>3. คุณจะเดินทางผ่านเส้นทางหรือจุดไหนบ้าง?</Text>
          <TextInput
            style={styles.locationInput}
            placeholder="เช่น ผ่านตึกเรียนรวม 2, หน้าหอ F3..."
            placeholderTextColor="#B0A498"
            value={routePassText}
            onChangeText={setRoutePassText}
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleOpenFlashBuy} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>เปิดบอร์ดรับงานด่วน 5 นาที</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal เลือกพิกัดแผนที่หรือจุด Preset */}
      <LocationPickerModal
        visible={pickerOpen === 'store'}
        kind="store"
        onClose={() => setPickerOpen(null)}
        onSelect={setSelectedStore}
      />
      <LocationPickerModal
        visible={pickerOpen === 'dropoff'}
        kind="dropoff"
        onClose={() => setPickerOpen(null)}
        onSelect={setSelectedDropoff}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  headerBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E8D5C4' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8D5C4' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#3A2113' },
  contentBox: { padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E8D5C4', marginBottom: 24 },
  cardQuestion: { fontSize: 14, fontWeight: 'bold', color: '#3A2113', marginBottom: 10 },
  pickerField: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    backgroundColor: '#FFFBF7', 
    borderWidth: 1, 
    borderColor: '#E8D5C4',
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 12,
    marginBottom: 12
  },
  pickerText: { flex: 1, fontSize: 13, color: '#3A2113', fontWeight: '600' },
  pickerPlaceholder: { color: '#B0A498', fontWeight: '500' },
  locationInput: { backgroundColor: '#FFFBF7', borderWidth: 1, borderColor: '#E8D5C4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: '#3A2113', fontWeight: '600' },
  submitBtn: { backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});