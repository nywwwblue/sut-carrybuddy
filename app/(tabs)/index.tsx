import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import FlashBuyIntroModal from '@/components/FlashBuyIntroModal';
import { buildSearchResultsRoute } from '@/lib/searchRouting';


interface RunnerPostRow {
  id: number;
  post_type: 'normal' | 'flash';
  fee_per_order: number;
  status: string;
  custom_origin_label: string | null;
  runner: { name: string; id: string; avatar_url: string | null; trust_scores: { trust_score: number }[] } | null;
  store: { name: string } | null;
  dropoff: { name: string } | null;
}

interface Rider {
  id: string;
  name: string;
  avatarUrl: string | null;
  trustScore: number;
  status: string;
  distance: string;
  price: string;
  isFlashBuy?: boolean;
  avatarColor: string;
}

const AVATAR_COLORS = ['#4A90E2', '#50C878', '#FF7A30', '#9B59B6', '#E74C3C'];

interface FlashSession {
  id: number;
  postId: number | null;
  storeName: string;
  runnerName: string;
  endsAt: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const [flashSession, setFlashSession] = useState<FlashSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [filterTab, setFilterTab] = useState('ทั้งหมด');
  const [ridersList, setRidersList] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. State ควบคุมโมดอล Flash Buy
  const [introVisible, setIntroVisible] = useState(false);

  const loadFlashSession = useCallback(async () => {
    const { data } = await supabase
      .from('flash_buy_sessions')
      .select('id, started_at, duration_seconds, runner_id, post:post_id ( id, custom_origin_label )')
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const row = data as any;
      const endsAt = new Date(row.started_at).getTime() + row.duration_seconds * 1000;
      if (endsAt > Date.now()) {
        let runnerName = 'Runner มทส.';
        if (row.runner_id) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('name')
            .eq('id', row.runner_id)
            .single();
          if (userProfile) runnerName = userProfile.name;
        }

        setFlashSession({
          id: row.id,
          postId: row.post?.id ?? null,
          storeName: row.post?.custom_origin_label || 'พิกัดด่วน มทส.',
          runnerName,
          endsAt
        });
        return;
      }
    }
    setFlashSession(null);
  }, []);

  useEffect(() => {
    const channelName = `home-flash-sessions-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flash_buy_sessions' }, () => {
        loadFlashSession();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadFlashSession]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('runner_posts')
      .select(
        `id, post_type, fee_per_order, status, custom_origin_label,
         runner:runner_id ( id, name, avatar_url, trust_scores ( trust_score ) ),
         store:store_id ( name ),
         dropoff:dropoff_id ( name )`
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30);

    if (filterTab === 'Flash Buy') {
      query = query.eq('post_type', 'flash');
    }

    const { data, error } = await query;

    if (!error && data) {
      const rows = data as unknown as RunnerPostRow[];
      setRidersList(
        rows.map((row, i) => ({
          id: String(row.id),
          name: row.runner?.name || 'ไม่ทราบชื่อ',
          avatarUrl: row.runner?.avatar_url || null,
          trustScore: row.runner?.trust_scores?.[0]?.trust_score ?? 100,
          status: row.status === 'open' ? 'เปิดรับฝาก' : row.status,
          distance: row.custom_origin_label || row.store?.name || 'ไม่ระบุต้นทาง',
          price: `ค่าหิ้ว ฿${Number(row.fee_per_order)}`,
          isFlashBuy: row.post_type === 'flash',
          avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        }))
      );
    }
    setLoading(false);
  }, [filterTab]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
      loadFlashSession();
    }, [loadPosts, loadFlashSession])
  );

  useEffect(() => {
    if (!flashSession) {
      setTimeLeft(0);
      return;
    }
    const interval = setInterval(() => {
      const left = Math.max(Math.floor((flashSession.endsAt - Date.now()) / 1000), 0);
      setTimeLeft(left);
      if (left === 0) setFlashSession(null);
    }, 1000);
    return () => clearInterval(interval);
  }, [flashSession]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPosts} tintColor="#FF7A30" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <Ionicons name="cube" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerLogoTextMain}>SUT</Text>
              <Text style={styles.headerLogoTextSub}>CarryBuddy</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationIcon} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications" size={22} color="#FF7A30" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#8B7E74" />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาพิกัดตึกเรียน หรือร้านค้าใน มทส. ..."
            placeholderTextColor="#C9BBAF"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => router.push(buildSearchResultsRoute(searchText))}
            returnKeyType="search"
          />
        </View>

        {/* Flash Buy Banner */}
        {flashSession && (
          <TouchableOpacity
            style={styles.flashBuyBanner}
            onPress={() => setIntroVisible(true)}
            activeOpacity={0.9}
          >
            <View style={styles.flashBuyTopRow}>
              <View style={styles.flashBuyContent}>
                <View style={styles.flashBuyIcon}>
                  <Ionicons name="flash" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.flashBuyTitle}>Flash Buy รับด่วนปุบปับ!</Text>
              </View>
              <View style={styles.flashBuyTimer}>
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              </View>
            </View>
            <Text style={styles.flashBuySubtitle}>
              มีเพื่อนกำลังมุ่งหน้าไปที่: <Text style={{fontWeight: 'bold', color: '#FFFFFF'}}>{flashSession.storeName}</Text> แตะด่วนเพื่อร่วมจอยส่งออเดอร์ฝากหิ้ว!
            </Text>
          </TouchableOpacity>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {['ทั้งหมด', 'Flash Buy'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterTab,
                filterTab === tab && styles.filterTabActive
              ]}
              onPress={() => setFilterTab(tab)}
            >
              <Text style={[
                styles.filterTabText,
                filterTab === tab && styles.filterTabTextActive
              ]}>
                {tab === 'ทั้งหมด' ? 'โพสต์ทั้งหมด' : '⚡ ด่วน Flash Buy'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Riders List */}
        <View style={styles.ridersList}>
          <Text style={styles.ridersSectionTitle}>รายการผู้รับหิ้วรอบตัวคุณ</Text>
          {loading ? (
            <ActivityIndicator color="#FF7A30" style={{ marginTop: 20 }} />
          ) : ridersList.length === 0 ? (
            <Text style={styles.emptyText}>ยังไม่มีเพื่อนเปิดโพสต์รับหิ้วเวลานี้</Text>
          ) : (
            ridersList.map(rider => (
              <TouchableOpacity key={rider.id} style={styles.riderCard} onPress={() => router.push({ pathname: '/rider-details', params: { postId: rider.id } })} activeOpacity={0.8}>
                <View style={styles.riderHeader}>
                  {/* แสดงรูปโปรไฟล์ ถ้าไม่มีให้แสดงชื่อย่อ */}
                  {rider.avatarUrl ? (
                    <Image source={{ uri: rider.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: rider.avatarColor }]}>
                      <Text style={styles.avatarText}>
                        {rider.name.substring(0, 2)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.riderInfo}>
                    <View style={styles.riderNameRow}>
                      <Text style={styles.riderName}>คุณ {rider.name}</Text>
                      <View style={styles.trustBadge}>
                        <Text style={styles.trustScoreText}>Trust {rider.trustScore}</Text>
                      </View>
                    </View>
                    <Text style={styles.riderStatus}>สถานะ: {rider.status}</Text>
                  </View>
                  <View style={styles.priceContainer}>
                    <Text style={styles.price}>{rider.price}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.riderDetailsRow}>
                  <View style={styles.riderDetails}>
                    <Ionicons name="storefront-outline" size={14} color="#FF7A30" />
                    <Text style={styles.riderDistance} numberOfLines={1}>กำลังไป: {rider.distance}</Text>
                  </View>
                  {rider.isFlashBuy && (
                    <View style={styles.flashBuyBadge}>
                      <Ionicons name="flash" size={10} color="#FF7A30" />
                      <Text style={styles.flashBuyBadgeText}>Flash Buy</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>
      

      {/* โมดอล Flash Buy Intro */}
      {flashSession && (
        <FlashBuyIntroModal
          visible={introVisible}
          runnerName={flashSession.runnerName}
          storeName={flashSession.storeName}
          timeLeft={formatTime(timeLeft)}
          onClose={() => setIntroVisible(false)}
          onConfirm={() => {
          setIntroVisible(false);
          if (flashSession.postId) {
            router.push({
              pathname: '/flash/flash-order-form',
              params: { 
                flashPostId: flashSession.postId,
                storeName: flashSession.storeName 
              }
            });
          }
        }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFBF7' 
  },
  header: { 
    paddingHorizontal: 20, 
    paddingVertical: 14, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  headerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  logoBox: { 
    width: 38, 
    height: 38, 
    borderRadius: 10, 
    backgroundColor: '#FF7A30', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  headerLogoTextMain: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#3A2113', 
    lineHeight: 18 
  },
  headerLogoTextSub: { 
    fontSize: 13, 
    fontWeight: '500', 
    color: '#8B7E74', 
    lineHeight: 14 
  },
  notificationIcon: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    backgroundColor: '#FFFFFF', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#F5EBE1' 
  },
  searchContainer: { 
    marginHorizontal: 20, 
    marginBottom: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    paddingHorizontal: 12, 
    borderWidth: 1, 
    borderColor: '#F5EBE1' 
  },
  searchInput: { 
    flex: 1, 
    paddingVertical: 12, 
    paddingHorizontal: 6, 
    fontSize: 13, 
    color: '#3A2113' 
  },
  flashBuyBanner: { 
    marginHorizontal: 20, 
    marginBottom: 16, 
    backgroundColor: '#FF7A30', 
    borderRadius: 18, 
    padding: 16, 
    gap: 8, 
    shadowColor: '#FF7A30', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 8, 
    elevation: 2 
  },
  flashBuyTopRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  flashBuyContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  flashBuyIcon: { 
    width: 28, 
    height: 28, 
    borderRadius: 8, 
    backgroundColor: 'rgba(255, 255, 255, 0.25)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  flashBuyTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  flashBuySubtitle: { 
    fontSize: 12, 
    color: 'rgba(255, 255, 255, 0.9)', 
    lineHeight: 18 
  },
  flashBuyTimer: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    paddingVertical: 4, 
    paddingHorizontal: 10 
  },
  timerText: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#FF7A30' 
  },
  filterContainer: { 
    paddingHorizontal: 20, 
    marginBottom: 16, 
    flexDirection: 'row', 
    gap: 10 
  },
  filterTab: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#F5EBE1', 
    backgroundColor: '#FFFFFF' 
  },
  filterTabActive: { 
    backgroundColor: '#FF7A30', 
    borderColor: '#FF7A30' 
  },
  filterTabText: { 
    fontSize: 12, 
    color: '#8B7E74', 
    fontWeight: '700' 
  },
  filterTabTextActive: { 
    color: '#FFFFFF' 
  },
  ridersList: { 
    paddingHorizontal: 20, 
    gap: 10 
  },
  ridersSectionTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#3A2113', 
    marginBottom: 6 
  },
  emptyText: { 
    fontSize: 13, 
    color: '#B0A498', 
    textAlign: 'center', 
    marginTop: 20 
  },
  riderCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 14, 
    borderWidth: 1, 
    borderColor: '#F5EBE1', 
    gap: 10, 
    shadowColor: '#3A2113', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.01, 
    shadowRadius: 4, 
    elevation: 1 
  },
  riderHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarImage: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#E8D5C4' 
  },
  avatarText: { 
    color: '#FFFFFF', 
    fontSize: 13, 
    fontWeight: 'bold' 
  },
  riderInfo: { 
    flex: 1 
  },
  riderNameRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  riderName: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#3A2113' 
  },
  trustBadge: { 
    backgroundColor: '#FFFBE6', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6 
  },
  trustScoreText: { 
    fontSize: 10, 
    color: '#FFB800', 
    fontWeight: '700' 
  },
  riderStatus: { 
    fontSize: 11, 
    color: '#2ECC71', 
    fontWeight: '600', 
    marginTop: 2 
  },
  priceContainer: { 
    backgroundColor: '#FFF3EB', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  price: { 
    fontSize: 12, 
    color: '#FF7A30', 
    fontWeight: 'bold' 
  },
  divider: { 
    height: 1, 
    backgroundColor: '#F5EBE1' 
  },
  riderDetailsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  riderDetails: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    flex: 1 
  },
  riderDistance: { 
    fontSize: 12, 
    color: '#8B7E74', 
    fontWeight: '500' 
  },
  flashBuyBadge: { 
    backgroundColor: '#FFF3EB', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 2, 
    paddingHorizontal: 6, 
    paddingVertical: 3, 
    borderRadius: 8 
  },
  flashBuyBadgeText: { 
    fontSize: 10, 
    color: '#FF7A30', 
    fontWeight: 'bold' 
  },
  spacer: { 
    height: 40 
  },
});