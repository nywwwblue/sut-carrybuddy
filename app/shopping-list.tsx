import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface ShoppingItem {
  id: string;
  ownerName: string;
  avatarColor: string;
  itemName: string;
  qty: number;
  isPicked: boolean;
}

export default function ShoppingListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const totalFee = params.totalFee ? Number(params.totalFee) : 55;
  const orderIds: string[] = params.orderIds ? JSON.parse(params.orderIds as string) : [];

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ดึงรายการออเดอร์ย่อยชิ้นต่อชิ้นจากใบรวมเพื่อนำมาคัดกรองจัดกลุ่ม
  useEffect(() => {
    const fetchItems = async () => {
      if (orderIds.length === 0) {
        // Mock ข้อมูลแสดงตามตัวอย่างรูปภาพ
        setItems([
          { id: '1', ownerName: 'แพร', avatarColor: '#4A90E2', itemName: 'กาแฟเย็น 1 แก้ว', qty: 1, isPicked: true },
          { id: '2', ownerName: 'ต้น', avatarColor: '#9B59B6', itemName: 'ชานมไข่มุก 1 แก้ว', qty: 1, isPicked: true },
          { id: '3', ownerName: 'มิน', avatarColor: '#2ECC71', itemName: 'น้ำเปล่า 2 ขวด', qty: 2, isPicked: false },
        ]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id, item_name, quantity, is_picked,
          order:order_id ( requester:requester_id ( name ) )
        `)
        .in('order_id', orderIds);

      if (!error && data) {
        const rows = data as any[];
        setItems(
          rows.map((row, i) => ({
            id: String(row.id),
            ownerName: row.order?.requester?.name || 'ลูกค้า',
            avatarColor: i % 2 === 0 ? '#4A90E2' : '#9B59B6',
            itemName: `${row.item_name} ${row.quantity} ชิ้น`,
            qty: row.quantity,
            isPicked: row.is_picked || false,
          }))
        );
      }
      setLoading(false);
    };

    fetchItems();
  }, []);

  // ฟังก์ชันสลับสถานะการเลือกช็อปปิ้งสินค้า (เช็คกล่อง/ขีดฆ่า)
  const togglePickItem = async (id: string, currentStatus: boolean) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, isPicked: !item.isPicked } : item));
    
    // อัปเดตสถานะคัดกรองลงบนตารางหลังบ้าน
    await supabase
      .from('order_items')
      .update({ is_picked: !currentStatus })
      .eq('id', id);
  };

  const pickedCount = items.filter(i => i.isPicked).length;
  const progressPercent = items.length > 0 ? Math.round((pickedCount / items.length) * 100) : 0;
  const remainingCount = items.length - pickedCount;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBox}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#3A2113" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ใบงานรวม Shopping List</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* แถบพิกัดตึกหอพักปลายทางหลัก */}
        <View style={styles.locationBar}>
          <Ionicons name="location" size={18} color="#FF5E13" />
          <Text style={styles.locationText}>DoiCha - Bundle {orderIds.length || 3} orders สุรนิเวศ 16</Text>
        </View>

        {/* รายการแสดงผลชิ้นส่วน Shopping List */}
        {loading ? (
          <ActivityIndicator color="#FF7A30" style={{ marginTop: 20 }} />
        ) : (
          items.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.itemCard}
              onPress={() => togglePickItem(item.id, item.isPicked)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, item.isPicked && styles.checkboxChecked]}>
                {item.isPicked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>

              <View style={[styles.avatarCircle, { backgroundColor: item.avatarColor }]}>
                <Text style={styles.avatarText}>{item.ownerName}</Text>
              </View>

              <Text style={[styles.itemText, item.isPicked && styles.itemTextCrossed]}>
                {item.ownerName} - {item.itemName}
              </Text>

              <View style={[styles.statusBadge, item.isPicked ? styles.badgePicked : styles.badgePending]}>
                <Text style={[styles.badgeText, item.isPicked ? styles.badgeTextPicked : styles.badgeTextPending]}>
                  {item.isPicked ? 'หยิบแล้ว' : 'ยังไม่ได้หยิบ'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* แถบหลอดแกนความคืบหน้าการทำงาน */}
        <View style={styles.progressSection}>
          <View style={styles.progressMeta}>
            <Text style={styles.progressLabel}>{pickedCount}/{items.length} รายการ หยิบแล้ว</Text>
            <Text style={styles.progressValue}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* กล่องสรุปค่าธรรมเนียมสะสมรวม */}
        <View style={styles.feeSummaryBox}>
          <Text style={styles.feeLabel}>ค่าหิ้วรวมที่จะได้รับ:</Text>
          <Text style={styles.feeAmount}>{totalFee}฿</Text>
        </View>

        {/* ปุ่มควบคุมความคืบหน้าใบงานหลัก */}
        <TouchableOpacity 
          style={[styles.actionSubmitBtn, remainingCount === 0 && styles.btnActiveSuccess]}
          disabled={remainingCount > 0}
          onPress={() => router.replace('/(runner-tabs)')}
        >
          <Text style={[styles.actionSubmitBtnText, remainingCount === 0 && styles.btnTextSuccess]}>
            {remainingCount > 0 ? `รออีก ${remainingCount} รายการ` : 'หยิบครบแล้ว ไปส่งของเลย!'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
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
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  scrollContent: {
    padding: 20,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#4A90E2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 20,
  },
  locationText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D0C4B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2ECC71',
    borderColor: '#2ECC71',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#3A2113',
  },
  itemTextCrossed: {
    textDecorationLine: 'line-through',
    color: '#B0A498',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePicked: {
    backgroundColor: '#E6F7ED',
  },
  badgePending: {
    backgroundColor: '#FFF3EB',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextPicked: {
    color: '#2ECC71',
  },
  badgeTextPending: {
    color: '#FF7A30',
  },
  progressSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#8B7E74',
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 12,
    color: '#FF7A30',
    fontWeight: 'bold',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#F0E5DC',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF5E13',
  },
  feeSummaryBox: {
    backgroundColor: '#FFF3EB',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  feeLabel: {
    fontSize: 13,
    color: '#B0A498',
    fontWeight: '600',
  },
  feeAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF5E13',
  },
  actionSubmitBtn: {
    backgroundColor: '#FFCBB3',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnActiveSuccess: {
    backgroundColor: '#FF5E13',
  },
  actionSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnTextSuccess: {
    color: '#FFFFFF',
  },
});