import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserProfile } from '@/hooks/useUserProfile';

export default function ModeSwitcher() {
  const router = useRouter();
  const { profile, trustScore, loading, refresh } = useUserProfile();
  const [selectedMode, setSelectedMode] = useState<'requester' | 'runner' | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleStart = () => {
    if (!selectedMode) return;
    router.replace(selectedMode === 'requester' ? '/(tabs)' : '/(runner-tabs)');
  };

  const initials = profile?.name ? profile.name.trim().slice(0, 2) : '..';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF7A30" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <Ionicons name="cube" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.headerTitle}>SUT CarryBuddy</Text>
          </View>
          <TouchableOpacity style={styles.bellButton} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications" size={20} color="#FF7A30" />
          </TouchableOpacity>
        </View>

        {/* Mode Select Card */}
        <View style={styles.modeCard}>
          <Text style={styles.modeCardTitle}>เลือกโหมดการใช้งาน</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modePill, selectedMode === 'requester' && styles.modePillActive]}
              onPress={() => setSelectedMode('requester')}
            >
              <Text style={[styles.modePillTitle, selectedMode === 'requester' && styles.modePillTitleActive]}>REQUESTER</Text>
              <Text style={[styles.modePillDesc, selectedMode === 'requester' && styles.modePillDescActive]}>ต้องการฝากหิ้ว</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modePill, selectedMode === 'runner' && styles.modePillActive]}
              onPress={() => setSelectedMode('runner')}
            >
              <Text style={[styles.modePillTitle, selectedMode === 'runner' && styles.modePillTitleActive]}>RUNNER</Text>
              <Text style={[styles.modePillDesc, selectedMode === 'runner' && styles.modePillDescActive]}>ต้องการรับหิ้ว</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Summary */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile?.name || 'ผู้ใช้งาน SUT CarryBuddy'}</Text>
            <Text style={styles.profileDept}>{profile?.department || 'ยังไม่ได้ระบุสาขาวิชา'}</Text>
          </View>
        </View>

        {/* Trust Score */}
        <View style={styles.trustCard}>
          <View style={styles.trustIconBox}>
            <Ionicons name="shield-checkmark" size={22} color="#FF7A30" />
          </View>
          <View>
            <Text style={styles.trustLabel}>แต้มความน่าเชื่อถือ</Text>
            <Text style={styles.trustValue}>Trust Score: {trustScore?.trust_score ?? 100}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{trustScore?.total_carries ?? 0}</Text>
            <Text style={styles.statLabel}>งานสำเร็จ</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{trustScore?.total_orders ?? 0}</Text>
            <Text style={styles.statLabel}>ออเดอร์ที่เคยฝากหิ้ว</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.startButton, !selectedMode && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!selectedMode}
        >
          <Text style={styles.startButtonText}>เริ่ม</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF7A30',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#3A2113' },
  bellButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  modeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#FF7A30',
    padding: 16, gap: 12,
  },
  modeCardTitle: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#3A2113' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modePill: {
    flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#E8D5C4',
  },
  modePillActive: { backgroundColor: '#FF7A30', borderColor: '#FF7A30' },
  modePillTitle: { fontSize: 13, fontWeight: 'bold', color: '#3A2113' },
  modePillTitleActive: { color: '#FFFFFF' },
  modePillDesc: { fontSize: 11, color: '#8B7E74', marginTop: 2 },
  modePillDescActive: { color: 'rgba(255,255,255,0.9)' },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#FF7A30',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  profileName: { fontSize: 16, fontWeight: 'bold', color: '#3A2113' },
  profileDept: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  trustCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFE8D6', borderRadius: 16, padding: 16,
  },
  trustIconBox: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  trustLabel: { fontSize: 11, color: '#8B7E74' },
  trustValue: { fontSize: 18, fontWeight: 'bold', color: '#FF7A30', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, alignItems: 'center',
  },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#FF7A30' },
  statLabel: { fontSize: 11, color: '#8B7E74', marginTop: 4, textAlign: 'center' },
  startButton: {
    backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  startButtonDisabled: { backgroundColor: '#F5C9A8' },
  startButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
