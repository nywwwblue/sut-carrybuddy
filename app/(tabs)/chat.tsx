import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface ChatPreview {
  orderId: number;
  name: string;
  message: string;
  timeLabel: string;
  avatarColor: string;
  unread: boolean;
}

const AVATAR_COLORS = ['#4A90E2', '#50C878', '#FF7A30', '#9B59B6'];

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

export default function ChatListScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChats = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;

    const { data: myOrders } = await supabase
      .from('orders')
      .select('id, requester:requester_id ( id, name ), runner:runner_id ( id, name )')
      .or(`requester_id.eq.${uid},runner_id.eq.${uid}`);

    if (!myOrders || myOrders.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const orderIds = myOrders.map((o: any) => o.id);
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('order_id, content, created_at, sender_id, is_read')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false });

    const seen = new Set<number>();
    const previews: ChatPreview[] = [];
    (messages || []).forEach((msg: any) => {
      if (seen.has(msg.order_id)) return;
      seen.add(msg.order_id);
      const order = myOrders.find((o: any) => o.id === msg.order_id) as any;
      const iAmRunner = order?.runner?.id === uid;
      const other = iAmRunner ? order?.requester : order?.runner;
      previews.push({
        orderId: msg.order_id,
        name: other?.name || 'ไม่ทราบชื่อ',
        message: msg.content || '',
        timeLabel: timeAgo(msg.created_at),
        avatarColor: AVATAR_COLORS[previews.length % AVATAR_COLORS.length],
        unread: msg.sender_id !== uid && !msg.is_read,
      });
    });

    setChats(previews);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ข้อความแชท</Text>
        </View>

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color="#FF7A30" style={{ marginTop: 20 }} />
          ) : chats.length === 0 ? (
            <Text style={styles.emptyText}>ยังไม่มีประวัติแชท คุณสามารถกดทักแชทคุยกับเพื่อนได้จากหน้ารายละเอียดออเดอร์</Text>
          ) : (
            chats.map((chat) => (
              <TouchableOpacity
                key={chat.orderId}
                style={[styles.chatItem, chat.unread && styles.chatItemUnread]}
                onPress={() => router.push({ pathname: '/chat-detail/[id]', params: { id: String(chat.orderId) } })}
                activeOpacity={0.9}
              >
                <View style={[styles.avatar, { backgroundColor: chat.avatarColor }]}>
                  <Text style={styles.avatarText}>{chat.name.substring(0, 2)}</Text>
                </View>

                <View style={styles.chatInfo}>
                  <View style={styles.chatHeader}>
                    <Text style={[styles.name, chat.unread && styles.nameUnread]} numberOfLines={1}>
                      {chat.name}
                    </Text>
                    <Text style={styles.time}>{chat.timeLabel}</Text>
                  </View>
                  <Text style={[styles.lastMessage, chat.unread && styles.lastMessageUnread]} numberOfLines={1}>
                    {chat.message}
                  </Text>
                </View>

                {chat.unread && <View style={styles.unreadBadge} />}
              </TouchableOpacity>
            ))
          )}
        </View>
        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#3A2113', letterSpacing: 0.3 },
  content: { paddingHorizontal: 16, gap: 4 },
  emptyText: { textAlign: 'center', color: '#B0A498', marginTop: 40, paddingHorizontal: 20, fontSize: 13, lineHeight: 20 },
  chatItem: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12,
    alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F5EBE1',
  },
  chatItemUnread: { backgroundColor: '#FFF3EB', borderColor: '#FFE0C7' },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  chatInfo: { flex: 1, gap: 2 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 14, fontWeight: '600', color: '#3A2113', flex: 1 },
  nameUnread: { fontWeight: 'bold', color: '#FF7A30' },
  time: { fontSize: 11, color: '#B0A498', flexShrink: 0 },
  lastMessage: { fontSize: 13, color: '#8B7E74' },
  lastMessageUnread: { color: '#3A2113', fontWeight: '500' },
  unreadBadge: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF7A30', flexShrink: 0, marginRight: 4 },
  spacer: { height: 40 },
});