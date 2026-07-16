import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

// ใช้แทนกล่อง "ยังไม่มี..." ที่แต่ละหน้า list เคยเขียนเองซ้ำๆ (order-history, chat list, notifications, open-requests-board ฯลฯ)
export function EmptyState({ icon = 'file-tray-outline', title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color="#E8D5C4" />
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
    color: '#8B7E74',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#B0A498',
    textAlign: 'center',
  },
});
