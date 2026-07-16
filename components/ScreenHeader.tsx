import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void; // ไม่ใส่ก็ได้ ค่าเริ่มต้นจะ router.back() ให้เอง
  rightElement?: React.ReactNode; // ปุ่ม/ไอคอนฝั่งขวา เช่น กระดิ่งแจ้งเตือน
}

/**
 * Header กลางที่ใช้แทนแถว "ปุ่มย้อนกลับวงกลม + ชื่อหน้า" ที่แต่ละหน้าเคยเขียนซ้ำกันเอง
 * ป้องกันปัญหาสไตล์ไม่ตรงกัน และกันบั๊ก native header ซ้อน (ทุกหน้าต้องปิด headerShown ที่ Stack อยู่แล้ว
 * component นี้คือ header จริงหนึ่งเดียวที่ควรโชว์)
 */
export function ScreenHeader({ title, subtitle, onBack, rightElement }: Props) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack || (() => router.back())}>
        <Ionicons name="chevron-back" size={22} color="#3A2113" />
      </TouchableOpacity>

      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>

      {rightElement ? <View style={styles.rightSlot}>{rightElement}</View> : <View style={styles.rightSlot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  subtitle: {
    fontSize: 11,
    color: '#8B7E74',
    marginTop: 2,
  },
  rightSlot: {
    width: 40,
    alignItems: 'flex-end',
  },
});
