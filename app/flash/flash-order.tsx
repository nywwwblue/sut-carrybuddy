import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ItemListEditor, EditableItem, calcItemTotal } from '@/components/ItemListEditor';

interface FlashPostDetail {
  id: number;
  runner_id: string;
  runner_name: string;
  store_id: number | null;
  store_name: string;
  fee_per_order: number;
  max_orders: number;
}

export default function FlashOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const flashPostId = params.flashPostId ? Number(params.flashPostId) : null;

  const [postDetail, setPostDetail] = useState<FlashPostDetail | null>(null);
  const [items, setItems] = useState<EditableItem[]>([{ name: '', quantity: '1', price: '' }]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const itemTotal = calcItemTotal(items);

  // ดึงข้อมูลรายละเอียดของโพสต์ด่วนจากฐานข้อมูล
  const loadFlashPostDetail = useCallback(async () => {
    if (!flashPostId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('runner_posts')
        .select(`
          id, runner_id, fee_per_order, max_orders,
          runner:runner_id ( name ),
          store:store_id ( name ),
          custom_origin_label
        `)
        .eq('id', flashPostId)
        .single();

      if (!error && data) {
        const raw = data as any;
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [flashPostId]);

  useFocusEffect(
    useCallback(() => {
      loadFlashPostDetail();
    }, [loadFlashPostDetail])
  );

  // ฟังก์ชันกดยืนยันเพื่อบันทึกคำสั่งซื้อเข้าระบบและล็อกเงินค้ำประกัน
  const handleConfirmOrder = async () => {
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกรายการสินค้าอย่างน้อย 1 อย่างครับ');
      return;
    }

    if (!postDetail) return;

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          requester_id: userData.user.id,
          post_id: postDetail.id,
          runner_id: postDetail.runner_id,
          store_id: postDetail.store_id,
          payment_mode: 'wallet',
          item_total: itemTotal,
          fee: postDetail.fee_per_order,
          status: 'accepted', // ตั้งเป็น accepted อัตโนมัติสำหรับฟลอร์จอยด่วนไม่ต้องรออนุมัติ
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

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
      {/* ส่วนหัวปิด-ย้อนกลับ ชิดขอบจอพอดีสวยงาม */}
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
        {/* การ์ดสรุปพิกัดร้านค้าและคนหิ้วใน มทส. */}
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

        {/* เรียกตัวจัดการเพิ่ม/ลบรายการสินค้าที่ผู้ใช้พิมพ์เลือกปกติ */}
        <Text style={styles.sectionLabel}>รายการสินค้าที่คุณต้องการสั่ง</Text>
        <ItemListEditor items={items} onChange={setItems} />

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>หมายเหตุถึงไรเดอร์ (ไม่บังคับ)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="เช่น เพิ่มเผ็ด, แยกน้ำแข็ง หรือรายละเอียดระบุชัดเจน"
          placeholderTextColor="#B0A498"
          value={note}
          onChangeText={setNote}
          multiline
        />

        {/* กล่องสรุปการคำนวณเงินสดมัดจำล่วงหน้า */}
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
            <Text style={styles.totalLabel}>ยอดรวมมัดจำในระบบ</Text>
            <Text style={styles.totalValue}>฿{(itemTotal + postDetail.fee_per_order).toFixed(0)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleConfirmOrder} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>ยืนยันร่วมส่งคำขอ</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// 🎨 จัดสไตล์เรียงบรรทัดแยก Property มินิมอล สวยระเบียบ
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textData: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 11,
    color: '#8B7E74',
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A2113',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3A2113',
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#3A2113',
    borderWidth: 1,
    borderColor: '#F5EBE1',
    minHeight: 65,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  summaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F5EBE1',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#8B7E74',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A2113',
  },
  divider: {
    height: 1,
    backgroundColor: '#F5EBE1',
    marginVertical: 6,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF7A30',
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
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#8B7E74',
    textAlign: 'center',
    fontWeight: '500',
  },
  backLink: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF3EB',
    borderRadius: 10,
  },
  backLinkText: {
    color: '#FF7A30',
    fontWeight: '700',
    fontSize: 13,
  },
});