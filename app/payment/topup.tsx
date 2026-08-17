import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import QRCode from 'react-native-qrcode-svg';
import generatePayload from 'promptpay-qr';

const PROMPTPAY_NUMBER = '0812345678'; // เบอร์พร้อมเพย์จำลอง

export default function TopupWalletScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'qr' | 'banking' | 'ewallet' | 'card'>('qr');
  
  // ฟอร์มสำหรับช่องทางอื่นๆ
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isWaiting && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isWaiting) {
      Alert.alert('หมดเวลา', 'รายการนี้หมดอายุแล้ว กรุณทำรายการใหม่อีกครั้ง');
      setIsWaiting(false);
      setQrPayload(null);
    }
    return () => clearInterval(timer);
  }, [isWaiting, timeLeft]);

  // ฟังก์ชันบันทึกยอดเงินเข้า Supabase จริง
  const executeTopupSuccess = async (numAmount: number, description: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('กรุณาเข้าสู่ระบบใหม่');

      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, available_balance')
        .eq('user_id', userData.user.id)
        .single();

      if (walletError || !wallet) throw new Error('ไม่พบข้อมูลกระเป๋าเงิน');

      const currentBalance = Number(wallet.available_balance) || 0;
      const newBalance = currentBalance + numAmount;

      const { error: updateError } = await supabase
        .from('wallets')
        .update({ available_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);

      if (updateError) throw updateError;

      const { error: txError } = await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        tx_type: 'topup',
        amount: numAmount,
        description: description,
      });

      if (txError) throw txError;

      Alert.alert('เติมเงินสำเร็จ', `ระบบได้รับยอดเงิน ฿${numAmount.toFixed(2)} เข้า Wallet เรียบร้อยแล้ว`, [
        { text: 'ตกลง', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('เติมเงินไม่สำเร็จ', err.message);
    } finally {
      setLoading(false);
      setIsWaiting(false);
    }
  };

  const handleProceedPayment = () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('ระบุยอดเงินไม่ถูกต้อง', 'กรุณากรอกจำนวนเงินที่ต้องการเติม');
      return;
    }

    if (selectedMethod === 'qr') {
      try {
        const payload = generatePayload(PROMPTPAY_NUMBER, { amount: numAmount });
        setQrPayload(payload);
        setTimeLeft(300);
        setIsWaiting(true);
      } catch (err: any) {
        Alert.alert('เกิดข้อผิดพลาด', err.message);
      }
    } else if (selectedMethod === 'banking') {
      Alert.alert('สลับแอปธนาคาร', 'จำลองการสลับไปแอปพลิเคชันธนาคารเพื่ออนุมัติยอดเงิน', [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'อนุมัติจ่ายเงิน', onPress: () => executeTopupSuccess(numAmount, 'เติมเงินผ่าน Mobile Banking (Sandbox)') }
      ]);
    } else if (selectedMethod === 'ewallet') {
      if (!phoneNumber || phoneNumber.length < 10) {
        Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกเบอร์โทรศัพท์ TrueMoney / Rabbit LINE Pay ให้ถูกต้อง');
        return;
      }
      Alert.alert('ยืนยัน OTP', 'ระบบส่งรหัส OTP ไปยังเบอร์ของคุณแล้ว (จำลอง OTP: 1234)', [
        { text: 'ยืนยันเติมเงิน', onPress: () => executeTopupSuccess(numAmount, 'เติมเงินผ่าน E-Wallet TrueMoney/LINE Pay') }
      ]);
    } else if (selectedMethod === 'card') {
      if (!cardNumber || !cardExp || !cardCvc) {
        Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลบัตรเครดิต/เดบิตให้ครบถ้วน');
        return;
      }
      Alert.alert('3D Secure OTP', 'กรอกรหัส OTP ธนาคารเพื่อยืนยันบัตร (จำลอง OTP: 5678)', [
        { text: 'ยืนยันตัดบัตร', onPress: () => executeTopupSuccess(numAmount, 'เติมเงินผ่าน Credit/Debit Card') }
      ]);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="เติมเงิน In-App Wallet" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.label}>ระบุจำนวนเงินที่ต้องการเติม (บาท)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#B0A498"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.quickChipRow}>
              {[50, 100, 300, 500].map((val) => (
                <TouchableOpacity key={val} style={styles.quickChip} onPress={() => setAmount(val.toString())}>
                  <Text style={styles.quickChipText}>฿{val}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!isWaiting ? (
            <>
              <Text style={[styles.label, { marginTop: 20 }]}>เลือกช่องทางการชำระเงิน</Text>
              
              <TouchableOpacity 
                style={[styles.methodCard, selectedMethod === 'qr' && styles.methodCardActive]} 
                onPress={() => setSelectedMethod('qr')}
              >
                <Ionicons name="qr-code-outline" size={22} color="#FF7A30" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.methodTitle}>PromptPay QR Code</Text>
                  <Text style={styles.methodDesc}>สแกนจ่ายผ่านทุกแอปธนาคาร</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.methodCard, selectedMethod === 'banking' && styles.methodCardActive]} 
                onPress={() => setSelectedMethod('banking')}
              >
                <Ionicons name="phone-portrait-outline" size={22} color="#FF7A30" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.methodTitle}>Mobile Banking App Switch</Text>
                  <Text style={styles.methodDesc}>สลับไปแอปธนาคารเพื่ออนุมัติทันที</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.methodCard, selectedMethod === 'ewallet' && styles.methodCardActive]} 
                onPress={() => setSelectedMethod('ewallet')}
              >
                <Ionicons name="wallet-outline" size={22} color="#FF7A30" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.methodTitle}>TrueMoney / Rabbit LINE Pay</Text>
                  <Text style={styles.methodDesc}>ตัดเงินผ่าน Wallet ค่ายอื่น</Text>
                </View>
              </TouchableOpacity>

              {selectedMethod === 'ewallet' && (
                <TextInput
                  style={styles.subInput}
                  placeholder="กรอกเบอร์โทรศัพท์ E-Wallet"
                  placeholderTextColor="#B0A498"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              )}

              <TouchableOpacity 
                style={[styles.methodCard, selectedMethod === 'card' && styles.methodCardActive]} 
                onPress={() => setSelectedMethod('card')}
              >
                <Ionicons name="card-outline" size={22} color="#FF7A30" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.methodTitle}>Credit / Debit Card</Text>
                  <Text style={styles.methodDesc}>ชำระผ่านบัตรเครดิตหรือเดบิต</Text>
                </View>
              </TouchableOpacity>

              {selectedMethod === 'card' && (
                <View style={{ gap: 8, marginBottom: 14 }}>
                  <TextInput style={styles.subInput} placeholder="หมายเลขบัตร 16 หลัก" placeholderTextColor="#B0A498" keyboardType="numeric" maxLength={16} value={cardNumber} onChangeText={setCardNumber} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[styles.subInput, { flex: 1 }]} placeholder="MM/YY" placeholderTextColor="#B0A498" value={cardExp} onChangeText={setCardExp} />
                    <TextInput style={[styles.subInput, { flex: 1 }]} placeholder="CVC" placeholderTextColor="#B0A498" keyboardType="numeric" maxLength={3} value={cardCvc} onChangeText={setCardCvc} />
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleProceedPayment}>
                <Text style={styles.primaryBtnText}>ดำเนินการชำระเงิน</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.qrContainer}>
              <Text style={styles.bankTitle}>PromptPay QR Code</Text>
              <Text style={styles.qrSubTitle}>ยอดชำระ: ฿{Number(amount).toFixed(2)}</Text>
              <View style={styles.qrBox}>
                {qrPayload && <QRCode value={qrPayload} size={180} />}
              </View>
              <Text style={styles.timerText}>หมดอายุใน: <Text style={{ color: '#E53935', fontWeight: 'bold' }}>{formatTime(timeLeft)}</Text></Text>
              
              <TouchableOpacity 
                style={[styles.simButton, loading && { opacity: 0.7 }]} 
                onPress={() => executeTopupSuccess(Number(amount), 'เติมเงินผ่าน PromptPay QR Code')}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.simButtonText}>🧪 จำลองสแกนจ่ายสำเร็จ</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsWaiting(false)}>
                <Text style={styles.cancelBtnText}>ย้อนกลับ / เปลี่ยนวิธีชำระเงิน</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF7' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F5EBE1', marginTop: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#3A2113', marginBottom: 8 },
  input: { backgroundColor: '#FFFBF7', borderWidth: 1, borderColor: '#E8D5C4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#3A2113', fontWeight: 'bold', marginBottom: 10 },
  subInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8D5C4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#3A2113', marginBottom: 6 },
  quickChipRow: { flexDirection: 'row', gap: 6 },
  quickChip: { flex: 1, backgroundColor: '#FFF3EB', borderWidth: 1, borderColor: '#FF7A30', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  quickChipText: { color: '#FF7A30', fontWeight: 'bold', fontSize: 13 },
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E8D5C4', marginBottom: 8 },
  methodCardActive: { borderColor: '#FF7A30', backgroundColor: '#FFF3EB', borderWidth: 1.5 },
  methodTitle: { fontSize: 13, fontWeight: 'bold', color: '#3A2113' },
  methodDesc: { fontSize: 11, color: '#8B7E74' },
  primaryBtn: { backgroundColor: '#FF7A30', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  primaryBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  qrContainer: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F5EBE1', marginTop: 10 },
  bankTitle: { fontSize: 16, fontWeight: 'bold', color: '#3A2113', marginBottom: 4 },
  qrSubTitle: { fontSize: 13, color: '#8B7E74', marginBottom: 14 },
  qrBox: { padding: 12, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E8D5C4', marginBottom: 14 },
  timerText: { fontSize: 12, color: '#8B7E74', marginBottom: 16 },
  simButton: { backgroundColor: '#2E7D32', width: '100%', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  simButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  cancelBtn: { paddingVertical: 8 },
  cancelBtnText: { color: '#8B7E74', fontWeight: '600', fontSize: 12 },
});