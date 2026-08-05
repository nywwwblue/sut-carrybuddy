import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { ORDER_THEME } from '@/constants/OrderTheme';

interface RunnerPost {
  id: number;
  post_type: 'normal' | 'flash';
  fee_per_order: number;
  max_orders: number;
  status: string;
  created_at: string;
  note: string | null;
  storeName: string;
  dropoffName: string;
}

export default function MyPostsManagementScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [posts, setPosts] = useState<RunnerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadMyPosts = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from('runner_posts')
      .select(`
        id, post_type, fee_per_order, max_orders, status, created_at, note,
        store:store_id ( name ), dropoff:dropoff_id ( name ),
        custom_origin_label
      `)
      .eq('runner_id', userData.user.id);

    if (activeTab === 'active') {
      query = query.eq('status', 'open');
    } else {
      query = query.in('status', ['in_progress', 'closed']);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(
        (data as any[]).map((row) => ({
          id: row.id,
          post_type: row.post_type,
          fee_per_order: Number(row.fee_per_order),
          max_orders: row.max_orders,
          status: row.status,
          created_at: row.created_at,
          note: row.note,
          storeName: row.store?.name || row.custom_origin_label || 'ระบุพิกัดเอง',
          dropoffName: row.dropoff?.name || 'จุดดรอปส่วนกลาง',
        }))
      );
    }
    setLoading(false);
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadMyPosts();
    }, [loadMyPosts])
  );

  const handleClosePost = (postId: number) => {
    Alert.alert('ยืนยันการปิดรับ', 'คุณต้องการปิดรับออเดอร์ใหม่สำหรับโพสต์นี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(postId);
          const { error } = await supabase
            .from('runner_posts')
            .update({ status: 'closed' })
            .eq('id', postId);

          setActionLoading(null);
          if (!error) {
            Alert.alert('สำเร็จ', 'ปิดรับออเดอร์สำหรับโพสต์นี้เรียบร้อยแล้ว');
            loadMyPosts();
          } else {
            Alert.alert('ผิดพลาด', error.message || 'ไม่สามารถปิดรับงานได้');
          }
        }
      }
    ]);
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'in_progress') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#E6F4EA' }]}>
          <Text style={[styles.statusBadgeText, { color: '#137333' }]}>กำลังวิ่งงาน</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#F1F3F4' }]}>
        <Text style={[styles.statusBadgeText, { color: '#5F6368' }]}>ปิดรับแล้ว</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="โพสต์รับหิ้วของฉัน" subtitle="จัดการและดูประวัติโพสต์วิ่งงานของคุณ" />

      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, activeTab === 'active' && styles.filterTabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Ionicons name="radio-button-on-outline" size={14} color={activeTab === 'active' ? '#FFFFFF' : '#8B7E74'} />
          <Text style={[styles.filterTabText, activeTab === 'active' && styles.filterTabTextActive]}>ที่กำลังเปิดรับ</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, activeTab === 'past' && styles.filterTabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Ionicons name="archive-outline" size={14} color={activeTab === 'past' ? '#FFFFFF' : '#8B7E74'} />
          <Text style={[styles.filterTabText, activeTab === 'past' && styles.filterTabTextActive]}>ปิดรับ/ประวัติเก่า</Text>
        </TouchableOpacity>
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF7A30" />
        </View>
      ) : posts.length === 0 ? (
        <EmptyState 
          icon={activeTab === 'active' ? 'megaphone-outline' : 'folder-open-outline'} 
          title={activeTab === 'active' ? 'ไม่มีโพสต์ที่เปิดอยู่' : 'ไม่มีประวัติโพสต์เก่า'} 
          subtitle={activeTab === 'active' ? 'คุณยังไม่มีโพสต์รับหิ้วที่กำลังเปิดรับในขณะนี้' : 'ไม่พบประวัติการลงโพสต์รับหิ้วเก่าในระบบ'} 
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMyPosts} tintColor={ORDER_THEME.accent} />}
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <View style={styles.cardHeader}>
                <View style={styles.routeContainer}>
                  <Text style={styles.routeText} numberOfLines={1}>{item.storeName}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#C9BBAF" style={{ marginHorizontal: 6 }} />
                  <Text style={styles.routeText} numberOfLines={1}>{item.dropoffName}</Text>
                </View>

                {activeTab === 'past' && renderStatusBadge(item.status)}
              </View>

              {!!item.note && <Text style={styles.noteText} numberOfLines={2}>“ {item.note} ”</Text>}

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="cash-outline" size={16} color="#8B7E74" />
                  <Text style={styles.infoLabel}>ค่าหิ้ว ฿{item.fee_per_order.toFixed(0)}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="people-outline" size={16} color="#8B7E74" />
                  <Text style={styles.infoLabel}>รับสูงสุด {item.max_orders} ออเดอร์</Text>
                </View>
              </View>

              {activeTab === 'active' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={styles.closeBtn} 
                    onPress={() => handleClosePost(item.id)}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? (
                      <ActivityIndicator color="#E74C3C" size="small" />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={16} color="#E74C3C" />
                        <Text style={styles.closeBtnText}>ปิดรับออเดอร์</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ORDER_THEME.backgroundAlt },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterTabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12, marginTop: 4 },
  filterTab: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: ORDER_THEME.surface, borderWidth: 1, borderColor: ORDER_THEME.border },
  filterTabActive: { backgroundColor: ORDER_THEME.accent, borderColor: ORDER_THEME.accent },
  filterTabText: { fontSize: 13, fontWeight: '600', color: ORDER_THEME.textSecondary },
  filterTabTextActive: { color: ORDER_THEME.surface },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  postCard: { backgroundColor: ORDER_THEME.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: ORDER_THEME.borderSoft, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  routeContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  routeText: { fontSize: 15, fontWeight: 'bold', color: ORDER_THEME.textPrimary, maxWidth: '42%' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
  noteText: { fontSize: 13, color: ORDER_THEME.textSecondary, fontStyle: 'italic', marginBottom: 10, backgroundColor: ORDER_THEME.surfaceSoft, padding: 8, borderRadius: 8 },
  divider: { height: 1, backgroundColor: ORDER_THEME.borderSoft, marginVertical: 4 },
  infoRow: { flexDirection: 'row', gap: 16, marginVertical: 10 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 13, color: ORDER_THEME.textPrimary, fontWeight: '500' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ORDER_THEME.dangerSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  closeBtnText: { color: ORDER_THEME.danger, fontSize: 13, fontWeight: 'bold' },
});