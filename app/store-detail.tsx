import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { EmptyState } from '@/components/EmptyState';

interface StoreInfo {
  id: number;
  name: string;
  location_name: string | null;
}

interface RunnerPost {
  id: number;
  runnerName: string;
  postType: 'normal' | 'flash';
  fee: number;
}

export default function StoreDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const storeId = params.storeId as string | undefined;

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [posts, setPosts] = useState<RunnerPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: storeData } = await supabase.from('stores').select('id, name, location_name').eq('id', storeId).single();
    if (storeData) setStore(storeData as StoreInfo);

    const { data: postData } = await supabase
      .from('runner_posts')
      .select('id, post_type, fee_per_order, runner:runner_id ( name )')
      .eq('store_id', storeId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (postData) {
      setPosts(
        (postData as any[]).map((p) => ({
          id: p.id,
          runnerName: p.runner?.name || 'ไม่ทราบชื่อ',
          postType: p.post_type,
          fee: Number(p.fee_per_order),
        }))
      );
    }
    setLoading(false);
  }, [storeId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerBox}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#3A2113" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#FF7A30" style={{ marginTop: 40 }} />
        ) : !store ? (
          <EmptyState icon="storefront-outline" title="ไม่พบข้อมูลร้านค้านี้" />
        ) : (
          <>
            <View style={styles.storeInfoSection}>
              <View style={styles.storeIconBox}>
                <Ionicons name="storefront" size={36} color="#FF7A30" />
              </View>
              <Text style={styles.storeName}>{store.name}</Text>
              {!!store.location_name && <Text style={styles.storeLocation}>📍 {store.location_name}</Text>}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Runner ที่สแตนบายรับหิ้วตอนนี้</Text>
              {posts.length === 0 ? (
                <Text style={styles.emptySubtext}>ยังไม่มีเพื่อนเปิดรับหิ้วที่ร้านนี้ในขณะนี้ ลองค้นหาเมนูบอร์ดกลางดูนะจ้า</Text>
              ) : (
                posts.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.postCard}
                    onPress={() => router.push({ pathname: '/rider-details', params: { postId: post.id } })}
                  >
                    <View style={styles.postAvatar}>
                      <Text style={styles.postAvatarText}>{post.runnerName.slice(0, 2)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postName}>คุณ {post.runnerName}</Text>
                      {post.postType === 'flash' && (
                        <View style={styles.flashBadge}>
                          <Ionicons name="flash" size={10} color="#FF7A30" />
                          <Text style={styles.flashBadgeText}>Flash Buy ด่วน</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.postFee}>฿{post.fee.toFixed(0)}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
                  </TouchableOpacity>
                ))
              )}
            </View>

            <TouchableOpacity style={styles.searchMoreBtn} onPress={() => router.push('/search-results')}>
              <Ionicons name="search" size={16} color="#FF7A30" />
              <Text style={styles.searchMoreText}>ค้นหารายชื่อ Runner เพิ่มเติม</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  headerBox: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F5EBE1'
  },
  emptySubtext: { fontSize: 13, color: '#B0A498', textAlign: 'center', paddingVertical: 24, lineHeight: 20 },
  storeInfoSection: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  storeIconBox: {
    width: 76, height: 76, borderRadius: 22, backgroundColor: '#FFF3EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#FFE0C7'
  },
  storeName: { fontSize: 20, fontWeight: 'bold', color: '#3A2113' },
  storeLocation: { fontSize: 13, color: '#8B7E74', marginTop: 4, fontWeight: '500' },
  section: { paddingHorizontal: 20, marginTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#3A2113', marginBottom: 12 },
  postCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#F5EBE1',
  },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4A90E2', alignItems: 'center', justifyContent: 'center' },
  postAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  postName: { fontSize: 14, fontWeight: '600', color: '#3A2113' },
  flashBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FFF3EB',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 4,
  },
  flashBadgeText: { fontSize: 9, color: '#FF7A30', fontWeight: 'bold' },
  postFee: { fontSize: 15, fontWeight: 'bold', color: '#FF7A30', marginRight: 4 },
  searchMoreBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginTop: 12, borderWidth: 1, borderColor: '#FF7A30',
    borderRadius: 14, paddingVertical: 14, backgroundColor: '#FFFFFF'
  },
  searchMoreText: { color: '#FF7A30', fontWeight: 'bold', fontSize: 13 },
});