import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type OrderStatus = 'pending' | 'accepted' | 'buying' | 'bought' | 'delivering' | 'completed' | 'cancelled';

const STATUS_META: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'รอตอบรับ', bg: '#FFF3E0', text: '#F5A623' },
  accepted: { label: 'รับออเดอร์แล้ว', bg: '#E8F1FC', text: '#4A90E2' },
  buying: { label: 'กำลังซื้อสินค้า', bg: '#E8F1FC', text: '#4A90E2' },
  bought: { label: 'ซื้อแล้ว รอส่ง', bg: '#E8F1FC', text: '#4A90E2' },
  delivering: { label: 'กำลังเดินทาง', bg: '#FFF3E0', text: '#F5A623' },
  completed: { label: 'สำเร็จ', bg: '#E6F7ED', text: '#2ECC71' },
  cancelled: { label: 'ยกเลิก', bg: '#FDECEC', text: '#E74C3C' },
};

interface Props {
  status: OrderStatus | string;
  size?: 'small' | 'medium';
}

// ใช้แทนที่โค้ด mapping สี/ข้อความสถานะที่แต่ละหน้า (order-history, order-detail, notifications) เคยเขียนเองแยกกัน
export function StatusPill({ status, size = 'medium' }: Props) {
  const meta = STATUS_META[status as OrderStatus] ?? { label: status, bg: '#F0E6DC', text: '#8B7E74' };
  const isSmall = size === 'small';

  return (
    <View style={[styles.pill, { backgroundColor: meta.bg }, isSmall && styles.pillSmall]}>
      <Text style={[styles.text, { color: meta.text }, isSmall && styles.textSmall]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  pillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  textSmall: {
    fontSize: 10,
  },
});
