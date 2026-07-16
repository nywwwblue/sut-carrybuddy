import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Store {
  id: number;
  name: string;
}

export default function FlashControllerScreen() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [customLocationText, setCustomLocationText] = useState('');
  
  // ฟิลด์บันทึกเส้นทางผ่าน (เช่น ผ่านสุรนิเวศ 16, ผ่านตึกเรียนรวม)
  const [routePassText, setRoutePassText] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // โหลดรายการร้านค้ายอดฮิตใน มทส.
  const loadPresetStores = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stores')
      .select('id, name')
      .limit(6);

    if (!error && data) {
      setStores(data as Store[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPresetStores();
    }, [loadPresetStores])
  );

  const handleOpenFlashBuy = async () => {
    if (!selectedStoreId && !customLocationText.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาเลือกร้านค้าต้นทางที่จะไปซื้อของครับ');
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

      // สร้างโพสต์หลักฝั่ง runner_posts
      const { data: postData, error: postError } = await supabase
        .from('runner_posts')
        .insert({
          runner_id: userData.user.id,
          store_id: selectedStoreId,
          custom_origin_label: selectedStoreId ? null : customLocationText.trim(),
          custom_route_pass: routePassText.trim(), // บันทึกเส้นทางผ่านลงฐานข้อมูล
          post_type: 'flash',
          max_orders: 5,
          fee_per_order: 15,
          status: 'open',
        })
        .select('id')
        .single();

      if (postError) throw postError;

      // บันทึกเซสชันลงตาราง flash_buy_sessions เพื่อเปิดให้ฝั่งคนซื้อเห็นป้ายแบนเนอร์เรียลไทม์
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: sessionError } = await supabase
        .from('flash_buy_sessions')
        .insert({
          runner_id: userData.user.id,
          store_id: selectedStoreId,
          post_id: postData.id,
          custom_location_label: selectedStoreId ? null : customLocationText.trim(),
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
          {/* ส่วนระบุสถานที่ต้นทาง */}
          <Text style={styles.cardQuestion}>คุณกำลังจะเดินทางไปที่ไหนใน มทส. ตอนนี้?</Text>
          
          <TextInput
            style={styles.locationInput}
            placeholder="พิมพ์ชื่อร้านค้า เช่น เซเว่นกาสะลอง, ร้านชานม..."
            placeholderTextColor="#B0A498"
            value={customLocationText}
            onChangeText={(text) => {
              setCustomLocationText(text);
              setSelectedStoreId(null);
            }}
          />

          <Text style={styles.subLabel}>หรือเลือกสถานที่ยอดฮิตด่วน:</Text>
          {loading ? (
            <ActivityIndicator color="#FF7A30" style={{ marginVertical: 10 }} />
          ) : (
            <View style={styles.chipGrid}>
              {stores.map((store) => {
                const isSelected = selectedStoreId === store.id;
                return (
                  <TouchableOpacity
                    key={store.id}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => {
                      setSelectedStoreId(store.id);
                      setCustomLocationText(store.name);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {store.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ส่วนระบุเส้นทางขากลับ / จุดที่ขับผ่าน */}
          <Text style={[styles.cardQuestion, { marginTop: 24 }]}>คุณจะเดินทางผ่านเส้นทางหรือจุดไหนบ้าง?</Text>
          <TextInput
            style={styles.locationInput}
            placeholder="เช่น ผ่านสุรนิเวศ 16, ตึกเรียนรวม 2..."
            placeholderTextColor="#B0A498"
            value={routePassText}
            onChangeText={setRoutePassText}
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleOpenFlashBuy} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>เปิดบอร์ดรับงานด่วน 5 นาที</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  contentBox: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    marginBottom: 24,
  },
  cardQuestion: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A2113',
    marginBottom: 12,
  },
  locationInput: {
    backgroundColor: '#FFFBF7',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#3A2113',
    fontWeight: '600',
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B7E74',
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#FFF3EB',
    borderColor: '#FF7A30',
  },
  chipText: {
    fontSize: 12,
    color: '#3A2113',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FF7A30',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#FF7A30',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});