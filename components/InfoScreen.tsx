import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface InfoScreenProps {
  title: string;
  children: React.ReactNode;
}

// โครงหน้าใช้ร่วมกันของ 3 เมนู: เกี่ยวกับแอป / เงื่อนไขการใช้งาน / นโยบายความเป็นส่วนตัว
// โลโก้ตรงกลาง + ปุ่มปิด (X) มุมขวาบน + กล่องข้อความสีขาวเลื่อนได้
export default function InfoScreen({ title, children }: InfoScreenProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* ปุ่มปิด */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#E08A8A" />
        </TouchableOpacity>

        {/* โลโก้ */}
        <View style={styles.logoBox}>
          <Ionicons name="cube" size={26} color="#FFFFFF" />
        </View>

        {/* หัวข้อ */}
        <Text style={styles.title}>{title}</Text>

        {/* กล่องเนื้อหา เลื่อนได้ */}
        <View style={styles.textBox}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.textBoxContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── ตัวอักษรมาตรฐานที่ใช้ในกล่องเนื้อหา ให้ทั้ง 3 หน้าเรียกใช้ร่วมกัน ───
export function InfoHeading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function InfoParagraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function InfoBullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>{'\u2022'}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    padding: 6,
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FF7A30',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3A2113',
    marginBottom: 16,
    textAlign: 'center',
  },
  textBox: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    overflow: 'hidden',
  },
  textBoxContent: {
    padding: 18,
    gap: 14,
  },
  heading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#3A2113',
    marginTop: 4,
  },
  paragraph: {
    fontSize: 13.5,
    lineHeight: 21,
    color: '#8B7E74',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 2,
  },
  bulletDot: {
    fontSize: 13.5,
    color: '#FF7A30',
  },
  bulletText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 21,
    color: '#8B7E74',
  },
});
