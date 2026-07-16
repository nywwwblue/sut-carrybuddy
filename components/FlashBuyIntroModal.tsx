import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FlashBuyIntroModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  runnerName: string;
  storeName: string;
  timeLeft: string;
}

export default function FlashBuyIntroModal({ visible, onClose, onConfirm, runnerName, storeName, timeLeft }: FlashBuyIntroModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheetContainer}>
          
          <View style={styles.sheetHeader}>
            <Text style={styles.headerTitle}>เปิดรับคำขอด่วน (Flash Buy)</Text>
          </View>

          <View style={styles.contentBody}>
            <View style={styles.runnerCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{runnerName.substring(0, 2)}</Text>
              </View>
              <View style={styles.runnerInfo}>
                <Text style={styles.runnerNameText}>คุณ {runnerName} กำลังอยู่หน้า {storeName}</Text>
              </View>
            </View>

            <View style={styles.timerZone}>
              <Text style={styles.timerText}>{timeLeft}</Text>
              <Text style={styles.timerSubText}>นาทีที่เหลือ หมดแล้วปิดรับทันที</Text>
            </View>

            <View style={styles.stepsContainer}>
              <View style={styles.stepRow}>
                <View style={styles.stepIconBox}>
                  <Ionicons name="basket-outline" size={18} color="#FF7A30" />
                </View>
                <Text style={styles.stepText}>Step 1: เลือกสินค้าที่ต้องการฝากซื้อ</Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepIconBox}>
                  <Ionicons name="location-outline" size={18} color="#FF7A30" />
                </View>
                <Text style={styles.stepText}>Step 2: เลือกจุดดรอปของใต้ตึกหอพัก มทส.</Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepIconBox}>
                  <Ionicons name="wallet-outline" size={18} color="#FF7A30" />
                </View>
                <Text style={styles.stepText}>Step 3: ยืนยันชำระเงินล็อกผ่านระบบ Wallet หักตามจริง</Text>
              </View>

              <View style={[styles.stepRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.stepIconBox, { backgroundColor: '#E6F7ED' }]}>
                  <Ionicons name="checkmark" size={18} color="#2ECC71" />
                </View>
                <Text style={styles.stepText}>Step 4: รอรับของและสแกนคิวอาร์โค้ดรับสินค้า</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={styles.actionBtnText}>ร่วมสั่งซื้อทันที</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>ไม่สนใจในครั้งนี้</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(58, 33, 19, 0.4)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFBF7',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheetHeader: {
    backgroundColor: '#FF7A30',
    paddingVertical: 18,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  contentBody: {
    padding: 20,
  },
  runnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  runnerInfo: {
    flex: 1,
  },
  runnerNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3A2113',
  },
  timerZone: {
    alignItems: 'center',
    marginVertical: 16,
  },
  timerText: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#FF7A30',
    letterSpacing: 1,
  },
  timerSubText: {
    fontSize: 12,
    color: '#8B7E74',
    fontWeight: '600',
    marginTop: 2,
  },
  stepsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EBE1',
  },
  stepIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C4638',
    flex: 1,
  },
  actionBtn: {
    backgroundColor: '#FF7A30',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF7A30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#B0A498',
    fontSize: 13,
    fontWeight: '600',
  },
});