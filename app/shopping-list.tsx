import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Modal, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

interface ShoppingItem {
  id: string;
  orderId: string;
  ownerName: string;
  avatarUrl: string | null;
  avatarColor: string;
  itemName: string;
  qty: number;
  price: number;
  isPicked: boolean;
}

export default function ShoppingListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paramFee = params.totalFee ? Number(params.totalFee) : 0;

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [storeName, setStoreName] = useState('พิกัดร้านค้า');
  const [dropoffName, setDropoffName] = useState('จุดส่งปลายทาง');
  const [totalFee, setTotalFee] = useState<number>(paramFee);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal สำหรับแก้ไขราคาจริง
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);
  const [newPriceText, setNewPriceText] = useState('');

  const fetchRealData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      let targetOrderIds: string[] = [];
      if (params.orderIds) {
        try {
          if (typeof params.orderIds === 'string') {
            targetOrderIds = JSON.parse(params.orderIds as string);
          } else if (Array.isArray(params.orderIds)) {
            targetOrderIds = params.orderIds as string[];
          }
        } catch (e) {
          const raw = String(params.orderIds);
          if (raw.includes(',')) targetOrderIds = raw.split(',').map(s => s.trim());
          else targetOrderIds = [raw];
        }
      } else if (params.orderId) {
        targetOrderIds = [String(params.orderId)];
      }

      if (targetOrderIds.length === 0) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: activeOrders, error: activeError } = await supabase
            .from('orders')
            .select('id, fee')
            .eq('runner_id', userData.user.id)
            .not('status', 'in', '(completed,cancelled)');

          if (activeError) {
            console.warn('ShoppingList: activeOrders error', activeError);
          }

          if (activeOrders && activeOrders.length > 0) {
            targetOrderIds = activeOrders.map((o: any) => o.id);
            const calculatedFee = activeOrders.reduce((sum: number, o: any) => sum + Number(o.fee || 0), 0);
            setTotalFee(calculatedFee);
          }
        }
      } else if (paramFee > 0) {
        setTotalFee(paramFee);
      }

      if (targetOrderIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      setOrderCount(targetOrderIds.length);

      const { data: itemData, error: itemError } = await supabase
        .from('order_items')
        .select(`
          id, order_id, item_name, quantity, actual_price, est_price, is_bought,
          order:order_id (
            id,
            fee,
            store:store_id ( name ),
            dropoff:dropoff_id ( name ),
            custom_dropoff_label,
            requester:requester_id ( name, avatar_url )
          )
        `)
        .in('order_id', targetOrderIds);

      if (!itemError && itemData && itemData.length > 0) {
        const rows = itemData as any[];
        const firstOrder = rows[0]?.order;
        if (firstOrder) {
          setStoreName(firstOrder.store?.name || 'ร้านค้า');
          setDropoffName(firstOrder.dropoff?.name || firstOrder.custom_dropoff_label || 'จุดส่งปลายทาง');
        }

        setItems(
          rows.map((row, i) => ({
            id: String(row.id),
            orderId: String(row.order_id),
            ownerName: row.order?.requester?.name || 'ลูกค้า',
            avatarUrl: row.order?.requester?.avatar_url || null,
            avatarColor: i % 2 === 0 ? '#4A90E2' : '#9B59B6',
            itemName: `${row.item_name} (${row.quantity} ชิ้น)`,
            qty: row.quantity,
            price: Number(row.actual_price ?? row.est_price ?? 0),
            isPicked: Boolean(row.is_bought ?? false),
          }))
        );
      } else {
        setItems([]);
        if (itemError) setLoadError(itemError.message || 'ไม่สามารถดึงรายการสินค้าได้');
      }
    } catch (err: any) {
      console.error('ShoppingList: fetch error', err);
      setLoadError(err?.message || String(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [params.orderIds, params.orderId, paramFee]);

  useEffect(() => {
    fetchRealData();
  }, [fetchRealData]);

  const togglePickItem = async (id: string, currentStatus: boolean) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, isPicked: !item.isPicked } : item));

    await supabase
      .from('order_items')
      .update({ is_bought: !currentStatus })
      .eq('id', id);
  };

  const handleOpenPriceModal = (item: ShoppingItem) => {
    setSelectedItem(item);
    setNewPriceText(String(item.price));
    setModalVisible(true);
  };

  const handleSavePrice = async () => {
    if (!selectedItem) return;
    const updatedPrice = parseFloat(newPriceText);
    if (isNaN(updatedPrice)) {
      Alert.alert('กรุณากรอกตัวเลขราคาให้ถูกต้อง');
      return;
    }

    setItems(prev => prev.map(i => i.id === selectedItem.id ? { ...i, price: updatedPrice } : i));
    setModalVisible(false);

    await supabase
      .from('order_items')
      .update({ actual_price: updatedPrice, est_price: updatedPrice })
      .eq('id', selectedItem.id);
  };

  const pickedCount = items.filter(i => i.isPicked).length;
  const progressPercent = items.length > 0 ? Math.round((pickedCount / items.length) * 100) : 0;
  const totalItemPrice = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="ใบงานรวม Shopping List" subtitle="ตรวจสอบและอัปเดตสถานะรายการสินค้า" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.locationBar}>
          <Ionicons name="location" size={18} color="#FF5E13" />
          <Text style={styles.locationText}>
            {storeName} {orderCount > 1 ? `- Bundle ${orderCount} orders` : ''} ({dropoffName})
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FF7A30" style={{ marginTop: 20 }} />
        ) : items.length === 0 ? (
          <>
            <Text style={styles.emptyText}>{loadError ? `ผิดพลาด: ${loadError}` : 'ไม่พบรายการสินค้าที่ต้องซื้อขณะนี้'}</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchRealData}>
              <Text style={styles.refreshText}>รีเฟรช</Text>
            </TouchableOpacity>
          </>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <TouchableOpacity
                style={styles.checkboxTouch}
                onPress={() => togglePickItem(item.id, item.isPicked)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, item.isPicked && styles.checkboxChecked]}>
                  {item.isPicked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.itemMainClick}
                onPress={() => router.push({ pathname: '/orders/order-detail', params: { orderId: item.orderId } } as any)}
                activeOpacity={0.8}
              >
                {/* แสดงรูปโปรไฟล์ของผู้สั่งซื้อ หรือ fallback เป็นตัวย่อ */}
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarCircle, { backgroundColor: item.avatarColor }]}>
                    <Text style={styles.avatarText}>{item.ownerName.slice(0, 2)}</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemText, item.isPicked && styles.itemTextCrossed]}>
                    {item.ownerName} - {item.itemName}
                  </Text>
                  <Text style={styles.itemPriceSub}>ราคาจริง: ฿{item.price}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editPriceBtn} onPress={() => handleOpenPriceModal(item)}>
                <Ionicons name="create-outline" size={18} color="#FF7A30" />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.progressSection}>
          <View style={styles.progressMeta}>
            <Text style={styles.progressLabel}>{pickedCount}/{items.length} รายการ หยิบแล้ว</Text>
            <Text style={styles.progressValue}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        <View style={styles.feeSummaryBox}>
          <View>
            <Text style={styles.feeLabel}>ค่าหิ้วรวมที่จะได้รับ:</Text>
            <Text style={styles.feeAmount}>{totalFee}฿</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.feeLabel}>ราคาสินค้าจ่ายจริง:</Text>
            <Text style={styles.feeAmount}>฿{totalItemPrice}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionSubmitBtn, styles.btnActiveSuccess]}
          onPress={() => router.replace('/(runner-tabs)')}
        >
          <Text style={[styles.actionSubmitBtnText, styles.btnTextSuccess]}>
            เสร็จสิ้น / กลับหน้าหลัก
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal แก้ไขราคาจริง */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>อัปเดตราคาจริงสินค้า</Text>
            <Text style={styles.modalSub}>{selectedItem?.itemName}</Text>

            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={newPriceText}
              onChangeText={setNewPriceText}
              placeholder="ระบุราคาจริง (บาท)"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSavePrice}>
                <Text style={styles.modalSaveText}>บันทึกราคา</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  checkboxTouch: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: 20 },
  locationBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#4A90E2', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 8, marginBottom: 20 },
  locationText: { fontSize: 13, fontWeight: 'bold', color: '#3A2113' },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F5EBE1', gap: 10 },
  itemMainClick: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D0C4B8', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8D5C4' },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  itemText: { fontSize: 13, fontWeight: '600', color: '#3A2113' },
  itemTextCrossed: { textDecorationLine: 'line-through', color: '#B0A498' },
  itemPriceSub: { fontSize: 11, color: '#FF7A30', fontWeight: 'bold', marginTop: 2 },
  editPriceBtn: { padding: 6, backgroundColor: '#FFF3EB', borderRadius: 8 },
  progressSection: { marginTop: 16, marginBottom: 20 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#8B7E74', fontWeight: '600' },
  progressValue: { fontSize: 12, color: '#FF7A30', fontWeight: 'bold' },
  progressTrack: { height: 6, backgroundColor: '#F0E5DC', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FF5E13' },
  feeSummaryBox: { backgroundColor: '#FFF3EB', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  feeLabel: { fontSize: 12, color: '#B0A498', fontWeight: '600' },
  feeAmount: { fontSize: 18, fontWeight: 'bold', color: '#FF5E13' },
  actionSubmitBtn: { backgroundColor: '#FFCBB3', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  btnActiveSuccess: { backgroundColor: '#FF5E13' },
  actionSubmitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  btnTextSuccess: { color: '#FFFFFF' },
  emptyText: { textAlign: 'center', color: '#8B7E74', marginVertical: 20 },
  refreshBtn: { alignSelf: 'center', backgroundColor: '#FFF3EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  refreshText: { color: '#FF7A30', fontWeight: 'bold', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 320, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#3A2113' },
  modalSub: { fontSize: 13, color: '#8B7E74', textAlign: 'center' },
  modalInput: { width: '100%', borderWidth: 1, borderColor: '#E8D5C4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#3A2113', textAlign: 'center', backgroundColor: '#FFFBF7' },
  modalBtnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  modalCancelBtn: { flex: 1, backgroundColor: '#F1F3F4', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: '#5F6368', fontWeight: 'bold', fontSize: 14 },
  modalSaveBtn: { flex: 1, backgroundColor: '#FF7A30', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalSaveText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});