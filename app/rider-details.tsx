import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import ReportModal from '@/components/ReportModal';

interface PostDetail {
  id: number;
  fee_per_order: number;
  max_orders: number;
  available_at: string | null;
  vehicle_type: string | null;
  runnerId: string;
  runnerName: string;
  avatarUrl: string | null;
  trustScore: number;
  totalCarries: number;
  storeName: string | null;
  dropoffName: string | null;
  note: string | null;
}

interface Review {
  id: number;
  rating_stars: number;
  comment: string | null;
}

export default function RiderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [reportVisible, setReportVisible] = useState(false);
  const postId = params.postId as string | undefined;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from('runner_posts')
      .select(
        `id, fee_per_order, max_orders, available_at, vehicle_type, note,
         runner:runner_id ( id, name, avatar_url, trust_scores ( trust_score, total_carries ) ),
         store:store_id ( name ),
         dropoff:dropoff_id ( name )`
      )
      .eq('id', postId)
      .single();

    if (!error && data) {
      const row = data as any;
      const runnerId = row.runner?.id;
      setPost({
        id: row.id,
        fee_per_order: row.fee_per_order,
        max_orders: row.max_orders,
        available_at: row.available_at,
        vehicle_type: row.vehicle_type,
        runnerId,
        runnerName: row.runner?.name || 'ไม่ทราบชื่อ',
        avatarUrl: row.runner?.avatar_url || null,
        trustScore: row.runner?.trust_scores?.[0]?.trust_score ?? 100,
        totalCarries: row.runner?.trust_scores?.[0]?.total_carries ?? 0,
        storeName: row.store?.name ?? null,
        dropoffName: row.dropoff?.name ?? null,
        note: row.note ?? null,
      });

      if (runnerId) {
        const { data: reviewRows } = await supabase
          .from('reviews')
          .select('id, rating_stars, comment')
          .eq('runner_id', runnerId)
          .order('created_at', { ascending: false })
          .limit(3);
        if (reviewRows) setReviews(reviewRows as Review[]);
      }
    }
    setLoading(false);
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const initials = post?.runnerName ? post.runnerName.trim().slice(0, 2) : '..';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="รายละเอียดโพสต์" 
        rightElement={
          <TouchableOpacity onPress={() => setReportVisible(true)} activeOpacity={0.7}>
            <Ionicons name="ellipsis-vertical" size={20} color="#3A2113" />
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#FF7A30" style={{ marginTop: 40 }} />
        ) : !post ? (
          <EmptyState icon="alert-circle-outline" title="ไม่พบข้อมูลโพสต์นี้" subtitle="อาจถูกปิดรับหรือจบงานไปแล้ว" />
        ) : (
          <>
            <View style={styles.profileSection}>
              {/* แสดงรูปภาพโปรไฟล์ หรือ Fallback ไปที่ตัวย่อชื่อ */}
              {post.avatarUrl ? (
                <Image source={{ uri: post.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#4A90E2' }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}

              <Text style={styles.riderName}>คุณ {post.runnerName}</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>Trust Score: {post.trustScore}</Text></View>

              <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{post.totalCarries}</Text>
                  <Text style={styles.statLabel}>งานสำเร็จ</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{post.max_orders}</Text>
                  <Text style={styles.statLabel}>รับได้สูงสุด</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>
                    {reviews.length > 0
                      ? (reviews.reduce((s, r) => s + r.rating_stars, 0) / reviews.length).toFixed(1)
                      : '5.0'}★
                  </Text>
                  <Text style={styles.statLabel}>คะแนนรีวิว</Text>
                </View>
              </View>

              <View style={styles.reviewsSection}>
                <Text style={styles.reviewSectionTitle}>รีวิวล่าสุดจากเพื่อน ๆ</Text>
                {reviews.length === 0 ? (
                  <Text style={styles.emptySubtext}>ยังไม่มีรีวิวย้อนหลังในระบบ</Text>
                ) : (
                  reviews.map(review => (
                    <View key={review.id} style={styles.reviewItem}>
                      <Text style={styles.reviewText}>{'★'.repeat(review.rating_stars)}{'☆'.repeat(5 - review.rating_stars)}</Text>
                      {!!review.comment && <Text style={styles.reviewDesc}>“ {review.comment} ”</Text>}
                    </View>
                  ))
                )}
              </View>
            </View>

            {!!post.note && (
              <View style={styles.noteBox}>
                <Ionicons name="chatbox-ellipses" size={16} color="#FF7A30" />
                <Text style={styles.noteText}>{post.note}</Text>
              </View>
            )}

            <View style={styles.detailsSection}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>📍 พิกัดร้านค้าต้นทาง</Text>
                <Text style={styles.detailValue}>{post.storeName || 'ปักหมุดตำแหน่งเอง'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>⏱️ เวลาที่พร้อมออกเดินทาง</Text>
                <Text style={styles.detailValue}>{post.available_at || 'ออกทันทีเมื่อของครบ'}</Text>
              </View>
              <View style={[styles.detailItem, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={styles.detailLabel}>🏢 ตึกหอพักปลายทาง</Text>
                <Text style={styles.detailValue}>{post.dropoffName || 'จุดดรอปของส่วนกลาง'}</Text>
              </View>
            </View>

            <View style={styles.feeSection}>
              <Text style={styles.feeLabel}>ค่าหิ้วออเดอร์นี้ (Rule-based):</Text>
              <Text style={styles.feeAmount}>฿{post.fee_per_order.toFixed(0)}</Text>
            </View>

            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => router.push({ pathname: '/orders/create-order', params: { postId: post.id, runnerId: post.runnerId, fee: post.fee_per_order } })}
            >
              <Text style={styles.contactButtonText}>กดส่งคำขอฝากซื้อของ</Text>
            </TouchableOpacity>

            <ReportModal
              visible={reportVisible}
              onClose={() => setReportVisible(false)}
              targetType="post"
              targetId={post?.id}
              targetLabel={`โพสต์ของ ${post?.runnerName ?? 'Runner'}`}
            />
          </>
        )}
        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  emptySubtext: { textAlign: 'center', color: '#B0A498', fontSize: 13, paddingVertical: 10 },
  profileSection: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarImage: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#E8D5C4', marginBottom: 12 },
  avatarText: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' },
  riderName: { fontSize: 18, fontWeight: 'bold', color: '#3A2113' },
  badge: { backgroundColor: '#E6F7ED', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 6, marginBottom: 16 },
  badgeText: { color: '#2ECC71', fontWeight: 'bold', fontSize: 12 },
  statsContainer: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 20 },
  statBox: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#F5EBE1',
  },
  statNumber: { fontSize: 16, fontWeight: 'bold', color: '#FF7A30' },
  statLabel: { fontSize: 11, color: '#8B7E74', fontWeight: '500' },
  reviewsSection: { width: '100%', gap: 8 },
  reviewSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#3A2113', marginBottom: 4 },
  reviewItem: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F5EBE1' },
  reviewText: { fontSize: 12, color: '#FFD700', marginBottom: 4, letterSpacing: 1 },
  reviewDesc: { fontSize: 13, color: '#5C4638', fontStyle: 'italic' },
  noteBox: {
    flexDirection: 'row', gap: 8, backgroundColor: '#FFF3EB', borderRadius: 12,
    padding: 14, marginHorizontal: 20, marginBottom: 16, borderWidth: 1, borderColor: '#FFE0C7'
  },
  noteText: { flex: 1, fontSize: 13, color: '#FF7A30', fontWeight: '500' },
  detailsSection: {
    paddingHorizontal: 16, backgroundColor: '#FFFFFF', marginHorizontal: 20,
    borderRadius: 16, paddingVertical: 16, gap: 12, borderWidth: 1, borderColor: '#F5EBE1',
  },
  detailItem: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F5EBE1' },
  detailLabel: { fontSize: 12, color: '#8B7E74', marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#3A2113' },
  feeSection: {
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF3EB',
    marginHorizontal: 20, marginBottom: 20, marginTop: 16, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  feeLabel: { fontSize: 13, color: '#3A2113', fontWeight: '600' },
  feeAmount: { fontSize: 18, fontWeight: 'bold', color: '#FF7A30' },
  contactButton: {
    marginHorizontal: 20, backgroundColor: '#FF7A30', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 20,
    shadowColor: '#FF7A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2
  },
  contactButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  spacer: { height: 40 },
});