import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface SearchResult {
  id: string;
  type: 'rider' | 'shop';
  refId: number;
  name: string;
  description: string;
  rating: number;
  badge?: string;
}

const ResultTypeIcon = ({ type }: { type: 'rider' | 'shop' | string }) => {
  const icons = {
    rider: { name: 'person-circle' as const, color: '#4A90E2' },
    shop: { name: 'storefront' as const, color: '#FF7A30' },
  };
  const icon = (type in icons) ? icons[type as keyof typeof icons] : icons.rider;
  return <Ionicons name={icon.name} size={40} color={icon.color} />;
};

export default function SearchResults() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchText, setSearchText] = useState((params.query as string) || '');
  const [filterType, setFilterType] = useState<'all' | 'rider' | 'shop'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      const [storesRes, postsRes] = await Promise.all([
        filterType !== 'rider'
          ? supabase.from('stores').select('id, name, location_name').ilike('name', `%${searchText}%`).limit(20)
          : Promise.resolve({ data: [] as any[] }),
        filterType !== 'shop'
          ? supabase
              .from('runner_posts')
              .select(`id, fee_per_order, runner:runner_id ( name, trust_scores ( trust_score ) ), store:store_id ( name )`)
              .eq('status', 'open')
              .limit(30)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const shopResults: SearchResult[] = (storesRes.data || []).map((s: any) => ({
        id: `shop-${s.id}`,
        type: 'shop',
        refId: s.id,
        name: s.name,
        description: s.location_name || 'ร้านค้าใน มทส.',
        rating: 0,
      }));

      const riderResults: SearchResult[] = (postsRes.data || [])
        .filter((p: any) => !searchText || p.runner?.name?.toLowerCase().includes(searchText.toLowerCase()) || p.store?.name?.toLowerCase().includes(searchText.toLowerCase()))
        .map((p: any) => ({
          id: `rider-${p.id}`,
          type: 'rider',
          refId: p.id,
          name: p.runner?.name || 'ไม่ทราบชื่อ',
          description: `ผ่าน ${p.store?.name || '-'} | ค่าหิ้ว ${p.fee_per_order}฿`,
          rating: p.runner?.trust_scores?.[0]?.trust_score ?? 100,
        }));

      setResults([...riderResults, ...shopResults]);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchText, filterType]);

  const ResultCard = ({ result }: { result: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() =>
        result.type === 'shop'
          ? router.push({ pathname: '/store-detail', params: { storeId: result.refId } })
          : router.push({ pathname: '/rider-details', params: { postId: result.refId } })
      }
      activeOpacity={0.8}
    >
      <View style={styles.resultIcon}>
        <ResultTypeIcon type={result.type} />
      </View>

      <View style={styles.resultContent}>
        <Text style={styles.resultName}>{result.name}</Text>
        <Text style={styles.resultDescription}>{result.description}</Text>
        {result.type === 'rider' && (
          <View style={styles.resultRating}>
            <Ionicons name="shield-checkmark" size={14} color="#2ECC71" />
            <Text style={styles.ratingValue}>Trust Score: {result.rating}</Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color="#C9BBAF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#3A2113" />
        </TouchableOpacity>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={16} color="#8B7E74" />
          <TextInput
            style={styles.input}
            placeholder="ค้นหาผู้รับหิ้วหรือร้านค้าใน มทส...."
            placeholderTextColor="#B0A498"
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
          />
          {!!searchText && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color="#B0A498" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs - แก้ไขสลักตัวค้างเรียบร้อย */}
      <View style={styles.tabWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabs}
          contentContainerStyle={styles.filterTabsContent}
        >
          {([
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'rider', label: 'ผู้รับหิ้ว' },
            { id: 'shop', label: 'ร้านค้า' }
          ] as const).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.filterTab,
                filterType === tab.id && styles.filterTabActive,
              ]}
              onPress={() => setFilterType(tab.id)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterType === tab.id && styles.filterTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator color="#FF7A30" style={{ marginTop: 40 }} />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={({ item }) => <ResultCard result={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search" size={36} color="#B0A498" />
          </View>
          <Text style={styles.emptyText}>ไม่พบผลการค้นหา</Text>
          <Text style={styles.emptySubtext}>ลองตรวจสอบตัวสะกด หรือค้นหาด้วยคำอื่นดูอีกครั้งครับ</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F5EBE1',
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F5EBE1',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#3A2113',
    fontWeight: '500',
    padding: 0,
  },
  tabWrapper: {
    height: 42,
    marginBottom: 8,
  },
  filterTabs: {
    paddingHorizontal: 16,
  },
  filterTabsContent: {
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F5EBE1',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: '#FF7A30',
    borderColor: '#FF7A30',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7E74',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5EBE1',
    gap: 12,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
  },
  resultIcon: {
    position: 'relative',
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  resultDescription: {
    fontSize: 12,
    color: '#8B7E74',
    marginTop: 3,
  },
  resultRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  ratingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2ECC71',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#8B7E74',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
});