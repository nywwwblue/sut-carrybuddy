import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORDER_THEME } from '@/constants/OrderTheme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

// ใช้แทนกล่อง "ยังไม่มี..." ที่แต่ละหน้า list เคยเขียนเองซ้ำๆ (order-history, chat list, notifications, open-requests-board ฯลฯ)
export function EmptyState({ icon = 'file-tray-outline', title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={ORDER_THEME.border} />
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: ORDER_THEME.textSecondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: ORDER_THEME.textMuted,
    textAlign: 'center',
  },
});
