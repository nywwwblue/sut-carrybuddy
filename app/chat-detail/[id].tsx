import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Message {
  id: number;
  senderId: string;
  text: string;
  timestamp: string;
}

export default function ChatDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const orderId = Number(id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('แชทกลุ่มย่อย มทส.');
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setMyUserId(uid);
    if (!uid || !orderId) return;

    const { data: order } = await supabase
      .from('orders')
      .select('requester_id, runner_id, requester:requester_id ( name ), runner:runner_id ( name )')
      .eq('id', orderId)
      .single();

    if (order) {
      const iAmRunner = (order as any).runner_id === uid;
      setOtherName(iAmRunner ? (order as any).requester?.name : (order as any).runner?.name);
    }

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, sender_id, content, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (msgs) {
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          text: m.content || '',
          timestamp: new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        }))
      );
      await supabase.from('chat_messages').update({ is_read: true }).eq('order_id', orderId).neq('sender_id', uid);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages])
  );

  // Realtime: แกะค่า payload เพื่อเช็คป้องกันอารามเบิ้ลข้อความซ้ำซ้อนฝั่ง Client
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`chat-order-${orderId}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${orderId}` }, (payload) => {
        const m = payload.new as any;
        setMessages((prev) => {
          // ถ้ามีข้อความ id นี้อยู่แล้ว ให้ข้ามไป ไม่ต้อง Push เบิ้ลซ้ำ
          if (prev.some((msg) => msg.id === m.id)) return prev;
          return [
            ...prev,
            { 
              id: m.id, 
              senderId: m.sender_id, 
              text: m.content || '', 
              timestamp: new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
            },
          ];
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const handleSendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !myUserId || !orderId) return;
    setNewMessage('');
    
    // ยิงขึ้น Database (Realtime Hook จะทำการสะท้อนกลับมาวาดบนจอเองอัตโนมัติ)
    await supabase.from('chat_messages').insert({
      order_id: orderId,
      sender_id: myUserId,
      content: text,
      msg_type: 'text',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#3A2113" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{otherName}</Text>
            <Text style={styles.headerStatus}>เลขออเดอร์ฝากหิ้ว #{orderId}</Text>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => {
            const isMe = message.senderId === myUserId;
            return (
              <View key={message.id} style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperOther]}>
                <View style={{ maxWidth: '80%' }}>
                  <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
                    <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>{message.text}</Text>
                  </View>
                  <Text style={[styles.timestamp, isMe ? styles.timestampMe : styles.timestampOther]}>{message.timestamp}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="พิมพ์ข้อความคุยรายละเอียด..."
              placeholderTextColor="#B0A498"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage} disabled={!newMessage.trim()}>
              <Ionicons name="send" size={18} color={newMessage.trim() ? '#FF7A30' : '#E8D5C4'} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F5EBE1', gap: 12,
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF3EB', alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: '#3A2113' },
  headerStatus: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  messagesContainer: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 16 },
  messageWrapper: { flexDirection: 'row', marginBottom: 14 },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperOther: { justifyContent: 'flex-start' },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  messageBubbleMe: { backgroundColor: '#FF7A30', borderBottomRightRadius: 4, alignSelf: 'flex-end' },
  messageBubbleOther: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#F5EBE1' },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTextMe: { color: '#FFFFFF', fontWeight: '500' },
  messageTextOther: { color: '#3A2113' },
  timestamp: { fontSize: 10, marginTop: 4, color: '#B0A498' },
  timestampMe: { textAlign: 'right', marginRight: 2 },
  timestampOther: { textAlign: 'left', marginLeft: 2 },
  inputContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F5EBE1' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1, backgroundColor: '#FFFBF7', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#3A2113', maxHeight: 80, borderWidth: 1, borderColor: '#F5EBE1'
  },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3EB', alignItems: 'center', justifyContent: 'center' },
});