import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LocationPickerModal, PickedLocation } from '@/components/LocationPickerModal';
import { ScreenHeader } from '@/components/ScreenHeader'; 

const VEHICLES: { id: 'walk' | 'bike' | 'moto' | 'car'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'walk', label: 'เดิน', icon: 'walk' },
  { id: 'bike', label: 'จักรยาน', icon: 'bicycle' },
  { id: 'moto', label: 'รถจักรยานยนต์', icon: 'flash' },
  { id: 'car', label: 'รถยนต์', icon: 'car' },
];

// สร้างรายการเวลาทุก ๆ 30 นาที ตลอด 24 ชั่วโมง
const GENERATE_TIMES = () => {
  const times = ['ออกทันทีเมื่อของครบ'];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const hStr = String(hour).padStart(2, '0');
      const mStr = String(min).padStart(2, '0');
      times.push(`${hStr}:${mStr} น.`);
    }
  }
  return times;
};

const ALL_TIME_OPTIONS = GENERATE_TIMES();

function locationLabel(loc: PickedLocation | null) {
  if (!loc) return null;
  return loc.type === 'preset' ? loc.name : loc.label;
}

function LocationField({ title, placeholder, value, onPress }: { title: string; placeholder: string; value: PickedLocation | null; onPress: () => void }) {
  const label = locationLabel(value);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{title}</Text>
      <TouchableOpacity style={styles.pickerField} onPress={onPress} activeOpacity={0.8}>
        <Ionicons name={value?.type === 'custom' ? 'pin' : 'location'} size={18} color="#FF7A30" />
        <Text style={[styles.pickerText, !label && styles.pickerPlaceholder]}>{label || placeholder}</Text>
        <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
      </TouchableOpacity>
    </View>
  );
}

export default function CreateRoutePost() {
  const router = useRouter();
  const [selectedStore, setSelectedStore] = useState<PickedLocation | null>(null);
  const [selectedDropoff, setSelectedDropoff] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState<'store' | 'dropoff' | null>(null);
  const [timeModalVisible, setTimeModalVisible] = useState(false); // ควบคุมการเปิดปิด Modal เวลา
  const [departTime, setDepartTime] = useState('ออกทันทีเมื่อของครบ');
  const [vehicle, setVehicle] = useState<'walk' | 'bike' | 'moto' | 'car'>('walk');
  const [maxOrders, setMaxOrders] = useState(3);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const feePerOrder = vehicle === 'car' ? 25 : vehicle === 'moto' ? 20 : vehicle === 'bike' ? 15 : 10;

  const handlePostRoute = async () => {
    if (submitting) return;

    if (!selectedStore || !selectedDropoff) {
      Alert.alert('ไม่ครบ', 'กรุณาเลือกสถานที่ต้นทางและตึกหอพักปลายทาง');
      return;
    }
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSubmitting(false);
      return;
    }

    // 🛠️ แปลงเวลา เช่น "12:30 น." ให้เหลือแค่ "12:30:00" หรือส่งเป็น null ถ้าเลือก "ออกทันทีเมื่อของครบ"
    let formattedTime: string | null = null;
    if (departTime && departTime !== 'ออกทันทีเมื่อของครบ') {
      const cleanTime = departTime.replace(' น.', '').trim(); // ตัดคำว่า " น." ออก
      formattedTime = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
    }

    const { error } = await supabase.from('runner_posts').insert({
      runner_id: userData.user.id,
      store_id: selectedStore.type === 'preset' ? selectedStore.id : null,
      dropoff_id: selectedDropoff.type === 'preset' ? selectedDropoff.id : null,
      custom_origin_lat: selectedStore.type === 'custom' ? selectedStore.lat : null,
      custom_origin_lng: selectedStore.type === 'custom' ? selectedStore.lng : null,
      custom_origin_label: selectedStore.type === 'custom' ? selectedStore.label : null,
      post_type: 'normal',
      vehicle_type: vehicle,
      max_orders: maxOrders,
      fee_per_order: feePerOrder,
      available_at: formattedTime, // 👈 ใช้ค่าที่ตัดคำว่า น. ออกแล้ว
      note: note || null,
      status: 'open',
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('โพสต์ไม่สำเร็จ', error.message);
      return;
    }

    Alert.alert('สำเร็จ', 'โพสต์ประกาศรับหิ้วของคุณแล้ว!', [
      { text: 'ไปที่หน้าหลัก', onPress: () => router.push('/(runner-tabs)') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="สร้างประกาศรับหิ้ว" subtitle="ระบุรายละเอียดเส้นทางวิ่งงานใน มทส." />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LocationField
          title="สถานที่ต้นทาง"
          placeholder="เลือกพิกัดร้านค้า/โรงอาหาร..."
          value={selectedStore}
          onPress={() => setPickerOpen('store')}
        />

        <Text style={styles.label}>เวลาออกเดินทาง</Text>
        <TouchableOpacity 
          style={styles.timeSelectorField} 
          onPress={() => setTimeModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="time" size={18} color="#FF7A30" />
          <Text style={styles.timeSelectorText}>{departTime}</Text>
          <Ionicons name="chevron-down" size={16} color="#C9BBAF" />
        </TouchableOpacity>

        <LocationField
          title="ตึกหอพักปลายทาง"
          placeholder="เลือกตึก/หอพักที่สะดวกนำส่ง..."
          value={selectedDropoff}
          onPress={() => setPickerOpen('dropoff')}
        />

        <Text style={styles.label}>ข้อความถึงผู้ฝากซื้อ (ไม่บังคับ)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="เช่น จะไปซื้อของที่ 7-11 หรือร้านค้า ใครอยากฝากอะไรพิมพ์ไว้ได้เลยจ้า"
          placeholderTextColor="#B0A498"
          value={note}
          onChangeText={setNote}
          multiline
        />

        <Text style={styles.label}>ประเภทพาหนะ</Text>
        <View style={styles.vehicleGrid}>
          {VEHICLES.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.vehicleChip, vehicle === v.id && styles.vehicleChipActive]}
              onPress={() => setVehicle(v.id)}
              activeOpacity={0.8}
            >
              <Ionicons name={v.icon} size={16} color={vehicle === v.id ? '#FF7A30' : '#3A2113'} style={{ marginBottom: 4 }} />
              <Text style={[styles.vehicleChipText, vehicle === v.id && styles.vehicleChipTextActive]}>{v.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.maxOrdersRow}>
          <Text style={styles.label}>จำกัดออเดอร์สูงสุด: {maxOrders} ออเดอร์</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => setMaxOrders(Math.max(1, maxOrders - 1))}>
              <Ionicons name="remove" size={16} color="#FF7A30" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => setMaxOrders(Math.min(10, maxOrders + 1))}>
              <Ionicons name="add" size={16} color="#FF7A30" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(maxOrders / 10) * 100}%` }]} />
        </View>

        <View style={styles.feeBox}>
          <View>
            <Text style={styles.feeLabel}>ค่าหิ้วเริ่มต้น (Rule-based)</Text>
            <Text style={styles.feeAmount}>฿{feePerOrder.toFixed(0)}</Text>
          </View>
          <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
        </View>

        <TouchableOpacity style={styles.postBtn} onPress={handlePostRoute} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF8EF" /> : <Text style={styles.postBtnText}>โพสต์ประกาศรับงาน</Text>}
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Modal เลือกเวลาทุกเวลาตลอด 24 ชั่วโมง */}
      <Modal visible={timeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เลือกเวลาออกเดินทาง</Text>
              <TouchableOpacity onPress={() => setTimeModalVisible(false)}>
                <Ionicons name="close" size={22} color="#3A2113" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={ALL_TIME_OPTIONS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = departTime === item;
                return (
                  <TouchableOpacity
                    style={[styles.timeOptionItem, isSelected && styles.timeOptionSelected]}
                    onPress={() => {
                      setDepartTime(item);
                      setTimeModalVisible(false);
                    }}
                  >
                    <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextSelected]}>
                      {item}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color="#FF7A30" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  scrollContent: { padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#3A2113', marginBottom: 8, letterSpacing: 0.2 },
  pickerField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F5EBE1',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16
  },
  pickerText: { flex: 1, fontSize: 14, color: '#3A2113', fontWeight: '600' },
  pickerPlaceholder: { color: '#B0A498', fontWeight: '500' },
  
  // สไตล์ช่องกดเลือกเวลา
  timeSelectorField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F5EBE1',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16,
    shadowColor: '#3A2113', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1
  },
  timeSelectorText: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#FF7A30' },

  // สไตล์ Modal เลือกเวลา
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%', paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#F5EBE1' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#3A2113' },
  timeOptionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#F9F2EC' },
  timeOptionSelected: { backgroundColor: '#FFF3EB', borderRadius: 10 },
  timeOptionText: { fontSize: 14, color: '#3A2113', fontWeight: '500' },
  timeOptionTextSelected: { fontSize: 14, color: '#FF7A30', fontWeight: 'bold' },

  noteInput: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 13, color: '#3A2113', borderWidth: 1, borderColor: '#F5EBE1', marginBottom: 20, minHeight: 80, textAlignVertical: 'top',
  },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  vehicleChip: {
    flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#F5EBE1',
  },
  vehicleChipActive: { borderColor: '#FF7A30', borderWidth: 1.5, backgroundColor: '#FFF3EB' },
  vehicleChipText: { fontSize: 13, fontWeight: '600', color: '#3A2113' },
  vehicleChipTextActive: { color: '#FF7A30', fontWeight: '700' },
  maxOrdersRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stepperRow: { flexDirection: 'row', gap: 8 },
  stepperBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF3EB',
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F0E5DC', overflow: 'hidden', marginBottom: 24 },
  progressFill: { height: '100%', backgroundColor: '#FF7A30', borderRadius: 3 },
  feeBox: {
    backgroundColor: '#FF7A30', borderRadius: 16, padding: 18, marginBottom: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#FF7A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 2
  },
  feeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500' },
  feeAmount: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', marginTop: 2 },
  postBtn: {
    backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#FF7A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3
  },
  postBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});