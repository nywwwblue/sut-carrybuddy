import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  score: number;
  size?: 'small' | 'medium';
}

// ใช้สีเดียวกันทุกหน้า (Home, rider-details, order-detail, chat header)
// เกณฑ์: >=80 เขียว (เชื่อถือได้), >=50 เหลือง (ปานกลาง), ต่ำกว่า แดง (เฝ้าระวัง)
function getScoreColor(score: number) {
  if (score >= 80) return { bg: '#E6F7ED', text: '#2ECC71' };
  if (score >= 50) return { bg: '#FFF3E0', text: '#F5A623' };
  return { bg: '#FDECEC', text: '#E74C3C' };
}

export function TrustScoreBadge({ score, size = 'medium' }: Props) {
  const colors = getScoreColor(score);
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, isSmall && styles.badgeSmall]}>
      <Ionicons name="shield-checkmark" size={isSmall ? 11 : 13} color={colors.text} />
      <Text style={[styles.text, { color: colors.text }, isSmall && styles.textSmall]}>Trust {score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start',
  },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  text: { fontSize: 12, fontWeight: 'bold' },
  textSmall: { fontSize: 10 },
});
