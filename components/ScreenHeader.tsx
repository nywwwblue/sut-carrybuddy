import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ORDER_THEME } from '@/constants/OrderTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, onBack, rightElement }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: Math.max(4, insets.top - 12) }]}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack || (() => router.back())} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color="#3A2113" />
      </TouchableOpacity>

      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>

      <View style={styles.rightSlot}>
        {rightElement}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 6, // 👈 ลดช่องว่างด้านล่างลง
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 38, // 👈 ปรับขนาดปุ่มให้กะทัดรัดขึ้น
    height: 38,
    borderRadius: 19,
    backgroundColor: ORDER_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ORDER_THEME.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: ORDER_THEME.textSecondary,
    marginTop: 1,
  },
  rightSlot: {
    width: 38, // 👈 ให้เท่ากับปุ่มซ้ายเป๊ะๆ
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});