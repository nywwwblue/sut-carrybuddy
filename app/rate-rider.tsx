import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function RateRider() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId ? Number(params.orderId) : null;
  const runnerId = params.runnerId as string | undefined;

  const [runnerName, setRunnerName] = useState('ผู้รับหิ้ว');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!runnerId) return;
    supabase.from('users').select('name').eq('id', runnerId).single().then(({ data }) => {
      if (data) setRunnerName(data.name);
    });
  }, [runnerId]);

  const handleSubmit = async () => {
    if (!orderId || !runnerId) {
      Alert.alert('ผิดพลาด', 'ไม่พบข้อมูลออเดอร์');
      return;
    }
    if (rating === 0) {
      Alert.alert('กรุณาให้คะแนน', 'กรุณาเลือกดาวให้คะแนนผู้รับหิ้ว');
      return;
    }

    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.rpc('submit_review_and_update_trust', {
      p_order_id: orderId,
      p_runner_id: runnerId,
      p_rating: rating,
      p_comment: comment || null,
    });

    if (error) {
      setSubmitting(false);
      Alert.alert('ส่งรีวิวไม่สำเร็จ', error.message);
      return;
    }

    setSubmitting(false);
    Alert.alert('สำเร็จ', 'ขอบคุณที่ให้คะแนนและรีวิว', [
      { text: 'ตกลง', onPress: () => router.replace('/(runner-tabs)') }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="ให้คะแนนผู้รับหิ้ว" />

      <View style={{ padding: 20 }}>
        {/* Rider Info Card */}
        <View style={styles.riderCard}>
          <View style={styles.riderAvatar}>
            <Ionicons name="person" size={22} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.riderName}>คุณ {runnerName}</Text>
            {orderId && <Text style={styles.riderOrder}>Order #{orderId}</Text>}
          </View>
        </View>

        {/* Stars */}
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
              <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={42} color="#FF7A30" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Comment */}
        <TextInput
          style={styles.commentInput}
          placeholder="เขียนความประทับใจหรือความคิดเห็นเพิ่มเติมให้เพื่อน มทส. รู้..."
          placeholderTextColor="#B0A498"
          value={comment}
          onChangeText={setComment}
          multiline
        />

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={18} color="#FF7A30" />
          <Text style={styles.infoText}>คะแนนรีวิวของคุณจะส่งผลต่อดัชนี Trust Score ของผู้รับหิ้วโดยตรง</Text>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>ส่งรีวิวและคะแนน</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  riderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#F5EBE1',
  },
  riderAvatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#4A90E2',
    alignItems: 'center', justifyContent: 'center',
  },
  riderName: { fontSize: 15, fontWeight: 'bold', color: '#3A2113' },
  riderOrder: { fontSize: 12, color: '#8B7E74', marginTop: 2 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 24, marginTop: 10 },
  commentInput: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, minHeight: 110,
    fontSize: 14, color: '#3A2113', textAlignVertical: 'top', marginBottom: 16,
    borderWidth: 1, borderColor: '#F5EBE1',
  },
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: '#FFF3EB', borderRadius: 12, padding: 14, marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 12, color: '#FF7A30', fontWeight: '500', lineHeight: 18 },
  submitBtn: {
    backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#FF7A30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});