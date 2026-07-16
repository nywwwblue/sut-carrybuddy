import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface IncomingOrder {
  id: string;
  name: string;
  destination: string;
  fee: number;
}

interface FlashLiveModalProps {
  visible: boolean;
  onClose: () => void;
  incomingOrders: IncomingOrder[];
  timeLeft: string;
  loading: boolean;
  onAcceptBundle: () => void;
  onCancelFlash: () => void;
}

export default function FlashLiveModal({
  visible,
  onClose,
  incomingOrders,
  timeLeft,
  loading,
  onAcceptBundle,
  onCancelFlash,
}: FlashLiveModalProps) {
  const totalBundleFee = incomingOrders.reduce((sum, order) => sum + order.fee, 0);
  const hasOrders = incomingOrders.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          
          {/* ส่วนหัวคุมธีม มีปุ่มกดปิดยุบป๊อปอัปด้านขวา */}
          <View style={styles.headerBox}>
            <View style={styles.headerLeft}>
              <Ionicons name="flash" size={16} color="#FF7A30" />
              <Text style={styles.headerTitle}>Runner Mode</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#8B7E74" />
            </TouchableOpacity>
          </View>

          {/* การ์ดส้มจับเวลานับถอยหลังทรงกลมตามแบบฟอร์มเดิม */}
          <View style={styles.timerCard}>
            <Text style={styles.timerStatusText}>กำลังรับออเดอร์ด่วน...</Text>
            <View style={styles.progressCircle}>
              <Text style={styles.timerDigits}>{timeLeft}</Text>
            </View>
            <Text style={styles.timerNote}>Server-controlled timer คุณปิดหน้านี้ได้ เวลายังวิ่งอยู่</Text>
          </View>

          {/* รายการออเดอร์สดพ่วงที่ส่งเข้ามา */}
          <View style={styles.liveSection}>
            <Text style={styles.sectionTitle}>ออเดอร์ด่วนที่เข้ามา</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>● LIVE</Text>
            </View>
          </View>

          <View style={styles.ordersContainer}>
            {loading ? (
              <ActivityIndicator color="#FF7A30" style={{ paddingVertical: 20 }} />
            ) : !hasOrders ? (
              <Text style={styles.emptyText}>ยังไม่มีออเดอร์ด่วนจอยเข้ามาในขณะนี้</Text>
            ) : (
              incomingOrders.map((order, index) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={[styles.avatarCircle, { backgroundColor: index % 2 === 0 ? '#4A90E2' : '#9B59B6' }]}>
                    <Text style={styles.avatarText}>{order.name.substring(0, 2)}</Text>
                  </View>
                  <View style={styles.orderMeta}>
                    <Text style={styles.orderRoute}>
                      {order.name} → <Text style={styles.destHighlight}>{order.destination}</Text>
                    </Text>
                  </View>
                  <Text style={styles.cardFee}>+{order.fee}฿</Text>
                </View>
              ))
            )}
          </View>

          {/* ปุ่มควบคุมลอจิกกดดำเนินการ */}
          <TouchableOpacity
            style={[styles.mainBundleBtn, !hasOrders && styles.btnDisabled]}
            onPress={onAcceptBundle}
            disabled={!hasOrders}
            activeOpacity={0.8}
          >
            <Text style={styles.mainBundleBtnText}>
              {hasOrders ? `รับทั้งหมด Bundle ${totalBundleFee}฿` : 'ยังไม่มีออเดอร์เข้ามา'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>เลือกรับทีละออเดอร์</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerBtn} onPress={onCancelFlash} activeOpacity={0.8}>
            <Text style={styles.dangerBtnText}>ปิดบอร์ด Flash Buy</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(58, 33, 19, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    backgroundColor: '#FFF8EF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    maxHeight: '90%',
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  timerCard: {
    backgroundColor: '#FF7A30',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  timerStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  timerDigits: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  timerNote: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    marginTop: 10,
    textAlign: 'center',
  },
  liveSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  liveBadge: {
    backgroundColor: '#FFEBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveText: {
    fontSize: 9,
    color: '#FF4D4D',
    fontWeight: '800',
  },
  ordersContainer: {
    maxHeight: 180,
    marginBottom: 14,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  orderMeta: {
    flex: 1,
    paddingHorizontal: 10,
  },
  orderRoute: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  destHighlight: {
    color: '#8B7E74',
    fontWeight: '500',
  },
  cardFee: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  emptyText: {
    fontSize: 12,
    color: '#8B7E74',
    textAlign: 'center',
    paddingVertical: 20,
  },
  mainBundleBtn: {
    backgroundColor: '#FF7A30',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: {
    backgroundColor: '#E8D5C4',
  },
  mainBundleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryBtnText: {
    color: '#8B7E74',
    fontSize: 13,
    fontWeight: '700',
  },
  dangerBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF7A30',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerBtnText: {
    color: '#FF7A30',
    fontSize: 13,
    fontWeight: '700',
  },
});