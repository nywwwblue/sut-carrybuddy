import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/lib/supabase';

const RING_SIZE = 160;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function ScoreRing({ score }: { score: number }) {
  const progress = Math.max(0, Math.min(score, 100)) / 100;
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="#FFE0C7"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="#FF7A30"
          strokeWidth={RING_STROKE}
          strokeDasharray={`${RING_CIRC * progress} ${RING_CIRC}`}
          strokeLinecap="round"
          fill="none"
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringScore}>{score}</Text>
        <Text style={styles.ringTotal}>/100</Text>
      </View>
    </View>
  );
}

function ScoreBar({ label, percent, color = '#FF7A30' }: { label: string; percent: number; color?: string }) {
  return (
    <View style={styles.scoreBarRow}>
      <View style={styles.scoreBarLabelRow}>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <Text style={[styles.scoreBarValue, { color }]}>{percent}%</Text>
      </View>
      <View style={styles.scoreBarTrack}>
        <View style={[styles.scoreBarFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, trustScore, loading, error, refresh } = useUserProfile();
  const [avgRating, setAvgRating] = useState<number | null>(null);

  const loadReviews = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from('reviews').select('rating_stars').eq('runner_id', userData.user.id);
    if (data && data.length > 0) {
      setAvgRating(data.reduce((s, r) => s + r.rating_stars, 0) / data.length);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadReviews();
    }, [refresh, loadReviews])
  );

  const trustBadge =
    (trustScore?.trust_score ?? 0) >= 80 ? 'เชื่อถือได้' : (trustScore?.trust_score ?? 0) >= 50 ? 'ปานกลาง' : 'เฝ้าระวัง';
  const cancellationPenalty = 100 - (trustScore?.responsibility_rate ?? 100);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF7A30" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { refresh(); loadReviews(); }} tintColor="#FF7A30" />}
      >
        <Text style={styles.pageTitle}>โปรไฟล์ของฉัน</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>ไม่สามารถโหลดข้อมูลได้: {error}</Text>
          </View>
        )}

        {/* ส่วนหัวแสดงรูปสัญลักษณ์ย่อ */}
        <View style={styles.profileHeader}>
          <View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>{profile?.name ? profile.name.trim().slice(0, 2) : '..'}</Text></View>
          <Text style={styles.profileName}>{profile?.name || 'ผู้ใช้งาน SUT CarryBuddy'}</Text>
          <Text style={styles.profileDept}>{profile?.department || 'ยังไม่ได้ระบุสาขาวิชา'}</Text>
        </View>

        {/* กล่องประมวลผลดัชนี Trust Score แบบวงแหวน */}
        <View style={styles.trustCard}>
          <ScoreRing score={trustScore?.trust_score ?? 100} />
          <View style={styles.badge}><Text style={styles.badgeText}>{trustBadge}</Text></View>

          <View style={styles.scoreBreakdown}>
            <Text style={styles.breakdownTitle}>รายละเอียดคะแนน</Text>
            <ScoreBar label="งานเสร็จสมบูรณ์" percent={trustScore?.effort_rate ?? 100} />
            <ScoreBar label="ตรงเวลา" percent={trustScore?.punctuality_rate ?? 100} />
            <ScoreBar label="คะแนนรีวิวเฉลี่ย" percent={avgRating ? Math.round((avgRating / 5) * 100) : 100} color="#FFB84D" />
            <ScoreBar label="Cancellation Penalty" percent={cancellationPenalty} color="#E74C3C" />
          </View>
        </View>

        {/* แถบสรุปจำนวนงานด่วนเชิงสถิติ */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#FF7A30' }]}>{trustScore?.total_carries ?? 0}</Text>
            <Text style={styles.statLabel}>รับหิ้วสำเร็จ</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#4A90E2' }]}>{trustScore?.total_orders ?? 0}</Text>
            <Text style={styles.statLabel}>ฝากหิ้วสำเร็จ</Text>
          </View>
        </View>

        {/* ปุ่มเมนูเชื่อมต่อหน้าย่อยอื่นๆ (แยกตามโหมดการใช้งาน) */}
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/payment/wallet')}>
            <Ionicons name="wallet" size={20} color="#FF7A30" />
            <Text style={styles.menuText}>กระเป๋าเงิน (Wallet)</Text>
            <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
          </TouchableOpacity>

          {/* ถ้าเป็นฝั่งผู้ซื้อ (Requester) ให้แสดงเมนูประวัติคำขอฝากซื้อ */}
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/orders/my-requests' as any)}>
            <Ionicons name="receipt" size={20} color="#FF7A30" />
            <Text style={styles.menuText}>ประวัติคำขอฝากซื้อของฉัน</Text>
            <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
          </TouchableOpacity>

          {/* ถ้าเป็นฝั่งคนรับหิ้ว (Runner) ให้แสดงเมนูจัดการโพสต์รับหิ้ว */}
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/runner/my-posts-management' as any)}>
            <Ionicons name="megaphone" size={20} color="#FF7A30" />
            <Text style={styles.menuText}>จัดการโพสต์รับหิ้วของฉัน</Text>
            <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => router.push('/settings')}>
            <Ionicons name="settings" size={20} color="#FF7A30" />
            <Text style={styles.menuText}>ตั้งค่าทั่วไป</Text>
            <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 16,
    alignItems: 'center',
  },
  pageTitle: {
    alignSelf: 'flex-start',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#C0392B',
    fontSize: 12,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 6,
  },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF7A30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bigAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  profileDept: {
    fontSize: 13,
    color: '#8B7E74',
  },
  trustCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringScore: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  ringTotal: {
    fontSize: 13,
    color: '#8B7E74',
  },
  badge: {
    backgroundColor: '#E6F7ED',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#2ECC71',
    fontWeight: 'bold',
    fontSize: 12,
  },
  scoreBreakdown: {
    width: '100%',
    gap: 12,
    marginTop: 4,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3A2113',
  },
  scoreBarRow: {
    gap: 4,
  },
  scoreBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreBarLabel: {
    fontSize: 12,
    color: '#3A2113',
  },
  scoreBarValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  scoreBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0E6DC',
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#8B7E74',
  },
  menuGroup: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: '#3A2113',
    fontWeight: '500',
  },
});
