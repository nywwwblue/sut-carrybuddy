import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function QRScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId ? Number(params.orderId) : null;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  // ขออนุญาตใช้งานกล้องจากผู้ใช้
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // เมื่อกล้องสแกนเจอ QR Code
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    // ตรวจสอบว่า QR Code ที่สแกนตรงกับรูปแบบออเดอร์ของเราไหม (เช่น CARRYBUDDY-ORDER-{id})
    const expectedData = `CARRYBUDDY-ORDER-${orderId}`;
    
    if (data === expectedData || data.includes(`ORDER-${orderId}`)) {
      try {
        // อัปเดตสถานะออเดอร์เป็น 'completed' และปลดล็อกเงินในระบบ
        const { error } = await supabase.rpc('release_escrow_and_complete', { p_order_id: orderId });
        
        if (error) throw error;

        Alert.alert('สำเร็จ 🎉', 'สแกน QR Code ยืนยันรับสินค้าเรียบร้อยแล้ว!', [
          { text: 'ตกลง', onPress: () => router.replace('/(tabs)') }
        ]);
      } catch (err: any) {
        Alert.alert('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถบันทึกการรับสินค้าได้', [
          { text: 'ลองใหม่', onPress: () => setScanned(false) }
        ]);
      }
    } else {
      Alert.alert('QR Code ไม่ถูกต้อง', `ข้อมูลใน QR ไม่ตรงกับออเดอร์ #${orderId} (ข้อมูลที่อ่านได้: ${data})`, [
        { text: 'สแกนใหม่', onPress: () => setScanned(false) }
      ]);
    }
  };

  if (hasPermission === null) {
    return <View style={styles.center}><Text>กำลังขออนุญาตใช้กล้อง...</Text></View>;
  }
  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center', marginBottom: 12 }}>ไม่มีสิทธิ์เข้าถึงกล้อง กรุณาเปิดการอนุญาตกล้องในการตั้งค่ามือถือ</Text>
        <TouchableOpacity style={styles.backBtnText} onPress={() => router.back()}>
          <Text style={{ color: '#FF7A30', fontWeight: 'bold' }}>ย้อนกลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        <View style={styles.overlay}>
          {/* ส่วนหัวปิดหน้าจอ */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>สแกน QR Code รับสินค้า</Text>
          </View>

          {/* กรอบเล็งสแกนตรงกลาง */}
          <View style={styles.scanAreaContainer}>
            <View style={styles.scanBox} />
            <Text style={styles.scanHint}>นำกล้องไปส่องที่ QR Code ของไรเดอร์</Text>
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  scanAreaContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 60 },
  scanBox: { width: 240, height: 240, borderWidth: 2, borderColor: '#FF7A30', borderRadius: 20, backgroundColor: 'transparent' },
  scanHint: { color: '#FFFFFF', marginTop: 16, fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  backBtnText: { padding: 10, backgroundColor: '#FFF3EB', borderRadius: 8 }
});