import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function QRScanner() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId ? Number(params.orderId) : null;

  const [scanned, setScanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSimulateScan = () => setScanned(true);

  const handleConfirm = async () => {
    if (!orderId) {
      Alert.alert('ผิดพลาด', 'ไม่พบเลขออเดอร์');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('release_escrow_and_complete', { p_order_id: orderId });
    setSubmitting(false);

    if (error) {
      Alert.alert('ยืนยันไม่สำเร็จ', error.message);
      return;
    }

    const { data: order } = await supabase.from('orders').select('id, runner_id').eq('id', orderId).single();

    Alert.alert('สำเร็จ!', 'ยืนยันการรับของและปลดล็อกเงินเรียบร้อยแล้ว', [
      { text: 'ให้คะแนนผู้รับหิ้ว', onPress: () => router.replace({ pathname: '/rate-rider', params: { orderId: order?.id, runnerId: order?.runner_id } }) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="สแกน QR Code" subtitle="รับสินค้าและปลดล็อกเงินมัดจำในระบบ" />

      <View style={{ padding: 20, flex: 1, justifyContent: 'center' }}>
        {!scanned ? (
          <TouchableOpacity style={styles.scanBox} onPress={handleSimulateScan} activeOpacity={0.8}>
            <View style={styles.scanIconCircle}>
              <Ionicons name="scan" size={36} color="#FF7A30" />
            </View>
            <Text style={styles.scanBoxText}>กดเพื่อจำลองการเปิดกล้องสแกน QR</Text>
            <Text style={styles.scanBoxSubText}>เมื่อรับสินค้าจากผู้รับหิ้วเรียบร้อยแล้ว</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.scanBox}>
            <View style={[styles.scanIconCircle, { backgroundColor: '#E6F7ED' }]}>
              <Ionicons name="checkmark-circle" size={40} color="#2ECC71" />
            </View>
            <Text style={styles.scanBoxText}>สแกนข้อมูล Order #{orderId} สำเร็จ</Text>
          </View>
        )}

        {scanned && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => setScanned(false)}>
              <Text style={styles.rejectBtnText}>ข้อมูลไม่ถูกต้อง</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmBtnText}>ยืนยันรับสินค้า</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  scanBox: {
    borderWidth: 2, borderColor: '#FF7A30', borderStyle: 'dashed', borderRadius: 24,
    paddingVertical: 60, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FFFFFF', shadowColor: '#3A2113', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1
  },
  scanIconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF3EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6
  },
  scanBoxText: { fontSize: 15, fontWeight: 'bold', color: '#3A2113' },
  scanBoxSubText: { fontSize: 12, color: '#8B7E74' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: '#E74C3C', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', backgroundColor: '#FDECEC'
  },
  rejectBtnText: { color: '#E74C3C', fontWeight: 'bold', fontSize: 14 },
  confirmBtn: {
    flex: 1, backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#2ECC71', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2
  },
  confirmBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});