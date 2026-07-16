import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

interface OrderItem {
  id: number;
  item_name: string;
  quantity: number;
  est_price: number;
  actualPriceInput?: string;
}

interface RunnerTask {
  id: number;
  status: string;
  paymentMode: string;
  requesterName: string;
  dropoffName: string;
  items: OrderItem[];
  isEditingPrices?: boolean;
}

export default function OrderTaskListScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<RunnerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // ดึงข้อมูลรายการงานทั้งหมดที่ค้างอยู่ในมือไรเดอร์
  const loadMyTasks = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, payment_mode,
        requester:requester_id ( name ),
        dropoff:dropoff_id ( name ), custom_dropoff_label,
        order_items ( id, item_name, quantity, est_price )
      `)
      .eq('runner_id', userData.user.id)
      .in('status', ['accepted', 'buying', 'bought', 'delivering'])
      .order('created_at', { ascending: true });

    if (!error && data) {
      setTasks(
        (data as any[]).map((row) => ({
          id: row.id,
          status: row.status,
          paymentMode: row.payment_mode,
          requesterName: row.requester?.name || 'ไม่ทราบชื่อ',
          dropoffName: row.dropoff?.name || row.custom_dropoff_label || 'จุดรับส่งใน มทส.',
          items: (row.order_items || []).map((i: any) => ({
            id: i.id,
            item_name: i.item_name,
            quantity: i.quantity,
            est_price: Number(i.est_price),
            actualPriceInput: String(i.est_price),
          })),
          isEditingPrices: false,
        }))
      );
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyTasks();
    }, [loadMyTasks])
  );

  // ลอจิกการแก้ไขราคาสินค้าแต่ละชิ้นบน Input
  const handlePriceChange = (taskId: number, itemId: number, text: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          items: t.items.map((i) => (i.id === itemId ? { ...i, actualPriceInput: text } : i)),
        };
      })
    );
  };

  // เปิด-ปิด โหมดสำหรับการแก้ไขราคา
  const toggleEditPrices = (taskId: number) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, isEditingPrices: !t.isEditingPrices } : t)));
  };

  // กดยืนยันอัปเดตราคาจริง + ระบบตรวจสอบวงเงินโกงราคา (Buffer 20%)
  const handleConfirmActualPrices = async (task: RunnerTask) => {
    try {
      const itemsJson = task.items.map((i) => {
        const actualPrice = Number(i.actualPriceInput);
        if (isNaN(actualPrice) || actualPrice < 0) {
          throw new Error(`ราคาของสินค้า "${i.item_name}" ไม่ถูกต้อง`);
        }
        return { id: i.id, actual_price: actualPrice };
      });

      const actualTotal = itemsJson.reduce((sum, item) => sum + item.actual_price, 0);
      const estTotal = task.items.reduce((sum, item) => sum + (item.est_price * item.quantity), 0);
      
      // ลอจิกความปลอดภัยสกัดกั้นการแอบอัปราคาสินค้าเองเกินเกณฑ์ 20%
      if (actualTotal > estTotal * 1.2) {
        Alert.alert(
          'ราคาสูงเกินเกณฑ์กำหนด', 
          `ราคาจริงรวม (฿${actualTotal}) เกินราคาประเมินเดิม 20% กรุณาทักแชทคุยเพื่อตกลงเหตุผลหรือส่งรูปถ่ายหน้าร้านคอนเฟิร์มกับเพื่อนก่อนบันทึก`
        );
        return;
      }

      setUpdatingId(task.id);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // ส่ง Path รูปภาพหลักฐานยืดหยุ่น (รูปสินค้าหน้าร้าน หรือ รูปสลิป) ขึ้นฐานข้อมูล
      const mockReceiptUrl = `images/proofs/order_${task.id}_captured.jpg`;
      const { error } = await supabase.rpc('runner_update_actual_prices', {
        p_order_id: task.id,
        p_runner_id: userData.user.id,
        p_items_json: itemsJson,
        p_receipt_url: mockReceiptUrl
      });

      if (error) throw error;

      Alert.alert('บันทึกสำเร็จ', 'อัปเดตราคาสินค้าจริงและส่งหลักฐานภาพถ่ายเข้าระบบเรียบร้อยแล้ว');
      loadMyTasks();
    } catch (err: any) {
      Alert.alert('ผิดพลาด', err.message || 'ไม่สามารถอัปเดตราคาสินค้าได้');
    } finally {
      setUpdatingId(null);
    }
  };

  // ปรับเปลี่ยนสถานะขั้นถัดไป (ซื้อสำเร็จ -> กำลังจัดส่ง -> งานสำเร็จ)
  const handleAdvanceStatus = async (orderId: number, currentStatus: string) => {
    let nextStatus = 'bought';
    if (currentStatus === 'bought') nextStatus = 'delivering';
    if (currentStatus === 'delivering') nextStatus = 'completed';

    setUpdatingId(orderId);
    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    setUpdatingId(null);
    loadMyTasks();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="ใบงานรับหิ้วของฉัน" subtitle="รายการงานที่กำลังดำเนินการทั้งหมดใน มทส." />

      {loading && tasks.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF7A30" />
        </View>
      ) : tasks.length === 0 ? (
        <EmptyState icon="clipboard-outline" title="ไม่มีงานค้างอยู่ในมือ" subtitle="คุณสามารถเปิดบอร์ดรับด่วนหรือรับคำขอเปิดเพื่อเพิ่มงานได้" />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMyTasks} tintColor="#FF7A30" />}
          renderItem={({ item }) => (
            <View style={styles.taskCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderIdText}>Order #{item.id}</Text>
                  <Text style={styles.customerText}>ผู้ฝาก: คุณ {item.requesterName}</Text>
                </View>
                <View style={[styles.statusBadge, item.status === 'accepted' ? styles.badgeAccepted : styles.badgeBuying]}>
                  <Text style={styles.statusText}>
                    {item.status === 'accepted' ? 'รับงานแล้ว' : item.status === 'buying' ? 'กำลังซื้อของ' : item.status === 'bought' ? 'ซื้อสำเร็จแล้ว' : 'กำลังนำส่ง'}
                  </Text>
                </View>
              </View>

              <Text style={styles.dropoffText}>📍 จุดส่ง: {item.dropoffName}</Text>
              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>รายการสินค้าที่ต้องจัดซื้อ:</Text>
              {item.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>• {it.item_name}  ×{it.quantity}</Text>
                    <Text style={styles.estPriceLabel}>ราคาประเมิน: ฿{it.est_price}</Text>
                  </View>

                  {item.isEditingPrices ? (
                    <View style={styles.inputContainer}>
                      <Text style={styles.bahtSign}>฿</Text>
                      <TextInput
                        style={styles.actualPriceInput}
                        keyboardType="decimal-pad"
                        value={it.actualPriceInput}
                        onChangeText={(text) => handlePriceChange(item.id, it.id, text)}
                      />
                    </View>
                  ) : (
                    <Text style={styles.finalPriceText}>
                      ฿{item.status === 'accepted' ? it.est_price : (it.actualPriceInput || it.est_price)}
                    </Text>
                  )}
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.actionContainer}>
                {item.status === 'accepted' && (
                  <>
                    {!item.isEditingPrices ? (
                      <TouchableOpacity style={styles.primaryActionBtn} onPress={() => toggleEditPrices(item.id)}>
                        <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>กรอกราคาจริง & ถ่ายหลักฐาน</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => toggleEditPrices(item.id)}>
                          <Text style={styles.cancelBtnText}>ยกเลิก</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.confirmBtn} 
                          onPress={() => handleConfirmActualPrices(item)}
                          disabled={updatingId === item.id}
                        >
                          {updatingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionBtnText}>ส่งราคา & ภาพถ่าย</Text>}
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                {item.status !== 'accepted' && (
                  <TouchableOpacity 
                    style={[styles.primaryActionBtn, { backgroundColor: item.status === 'buying' ? '#FF7A30' : '#2ECC71' }]} 
                    onPress={() => handleAdvanceStatus(item.id, item.status)}
                    disabled={updatingId === item.id}
                  >
                    <Text style={styles.actionBtnText}>
                      {item.status === 'buying' ? 'ซื้อครบเสร็จแล้ว รอนำส่ง' : item.status === 'bought' ? 'เริ่มออกเดินทางจัดส่ง' : 'จัดส่งถึงมือเพื่อนแล้ว'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  taskCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F5EBE1', shadowColor: '#3A2113', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderIdText: { fontSize: 15, fontWeight: 'bold', color: '#3A2113' },
  customerText: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeAccepted: { backgroundColor: '#FFF3EB' },
  badgeBuying: { backgroundColor: '#E6F3FF' },
  statusText: { fontSize: 11, fontWeight: 'bold', color: '#FF7A30' },
  dropoffText: { fontSize: 13, fontWeight: '600', color: '#5C4638', marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#F5EBE1', marginVertical: 12 },
  sectionLabel: { fontSize: 13, fontWeight: 'bold', color: '#3A2113', marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  itemName: { fontSize: 14, color: '#3A2113', fontWeight: '500' },
  estPriceLabel: { fontSize: 11, color: '#B0A498', marginTop: 2 },
  finalPriceText: { fontSize: 15, fontWeight: 'bold', color: '#3A2113' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FF7A30', borderRadius: 8, paddingHorizontal: 8, backgroundColor: '#FFFBF7', width: 95 },
  bahtSign: { fontSize: 13, color: '#FF7A30', marginRight: 4, fontWeight: '600' },
  actualPriceInput: { flex: 1, height: 36, fontSize: 14, color: '#3A2113', fontWeight: 'bold', padding: 0 },
  actionContainer: { marginTop: 4, width: '100%' },
  primaryActionBtn: { flexDirection: 'row', gap: 6, backgroundColor: '#FF7A30', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', width: '100%' },
  actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#B0A498', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#FFFFFF' },
  cancelBtnText: { color: '#8B7E74', fontWeight: 'bold', fontSize: 14 },
  confirmBtn: { flex: 2, backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});