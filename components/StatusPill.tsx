import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ORDER_THEME } from '@/constants/OrderTheme';

export type OrderStatus = 'pending' | 'accepted' | 'buying' | 'bought' | 'delivering' | 'completed' | 'cancelled';

const STATUS_META: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'รอตอบรับ', bg: ORDER_THEME.warningSoft, text: ORDER_THEME.warning },
  accepted: { label: 'รับออเดอร์แล้ว', bg: ORDER_THEME.infoSoft, text: ORDER_THEME.info },
  buying: { label: 'กำลังซื้อสินค้า', bg: ORDER_THEME.infoSoft, text: ORDER_THEME.info },
  bought: { label: 'ซื้อแล้ว รอส่ง', bg: ORDER_THEME.infoSoft, text: ORDER_THEME.info },
  delivering: { label: 'กำลังเดินทาง', bg: ORDER_THEME.warningSoft, text: ORDER_THEME.warning },
  completed: { label: 'สำเร็จ', bg: ORDER_THEME.successSoft, text: ORDER_THEME.success },
  cancelled: { label: 'ยกเลิก', bg: ORDER_THEME.dangerSoft, text: ORDER_THEME.danger },
};

interface Props {
  status: OrderStatus | string;
  size?: 'small' | 'medium';
}

// ใช้แทนที่โค้ด mapping สี/ข้อความสถานะที่แต่ละหน้า (order-history, order-detail, notifications) เคยเขียนเองแยกกัน
export function StatusPill({ status, size = 'medium' }: Props) {
  const meta = STATUS_META[status as OrderStatus] ?? { label: status, bg: ORDER_THEME.borderSoft, text: ORDER_THEME.textSecondary };
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
