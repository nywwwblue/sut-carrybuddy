import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function TopUpWithdraw() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mode = (params.mode as 'topup' | 'withdraw') || 'topup';

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      Alert.alert('จำนวนไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินให้ถูกต้อง');
      return;
    }

    setSubmitting(true);
    
    try {
      // ดึงข้อมูล User ขึ้นมาตรวจสอบสิทธิ์
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setSubmitting(false);
        return;
      }

      // เรียกฟังก์ชัน RPC จัดการเติม/ถอนเงินผ่านหลังบ้านอย่างปลอดภัย
      const { error: txError } = await supabase.rpc('process_wallet_transaction', {
        p_mode: mode,
        p_amount: value
      });

      if (txError) throw txError;

      Alert.alert('สำเร็จ', mode === 'topup' ? `เติมเงิน ฿${value} เรียบร้อยแล้ว` : `ถอนเงิน ฿${value} เรียบร้อยแล้ว`, [
        { text: 'ตกลง', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('ผิดพลาด', err.message || 'ไม่สามารถทำรายการธุรกรรมได้');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={mode === 'topup' ? 'เติมเงินเข้า Wallet' : 'ถอนเงินออกจาก Wallet'} />

      <View style={{ padding: 20 }}>
        <Text style={styles.label}>จำนวนเงิน (บาท)</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0"
          placeholderTextColor="#D4C5BA"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((v) => (
            <TouchableOpacity key={v} style={styles.quickChip} onPress={() => setAmount(String(v))}>
              <Text style={styles.quickChipText}>฿{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>{mode === 'topup' ? 'เติมเงิน' : 'ถอนเงิน'}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFF8EF' 
  },
  label: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#3A2113', 
    marginBottom: 8 
  },
  amountInput: {
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    borderWidth: 1.5, 
    borderColor: '#FF7A30',
    paddingHorizontal: 16, 
    paddingVertical: 16, 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#3A2113', 
    marginBottom: 16,
  },
  quickRow: { 
    flexDirection: 'row', 
    gap: 10, 
    marginBottom: 24 
  },
  quickChip: { 
    flex: 1, 
    backgroundColor: '#FFE8D6', 
    borderRadius: 12, 
    paddingVertical: 12, 
    alignItems: 'center' 
  },
  quickChipText: { 
    color: '#FF7A30', 
    fontWeight: '700', 
    fontSize: 13 
  },
  submitBtn: { 
    backgroundColor: '#FF7A30', 
    borderRadius: 14, 
    paddingVertical: 16, 
    alignItems: 'center' 
  },
  submitBtnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
});