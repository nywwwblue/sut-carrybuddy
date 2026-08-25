import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const CODE_LENGTH = 6;

// หน้านี้จะโผล่ขึ้นมาเองหลัง login ด้วยรหัสผ่านสำเร็จ ถ้าบัญชีเปิดใช้ 2FA (TOTP) ไว้
// (ควบคุมโดย useProtectedRoute.ts ที่เช็ค AAL ของ session)
export default function MfaVerifyScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH) {
      Alert.alert('กรอกไม่ครบ', `กรุณากรอกรหัส ${CODE_LENGTH} หลักจากแอป Authenticator`);
      return;
    }

    setLoading(true);

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setLoading(false);
      Alert.alert('เกิดข้อผิดพลาด', factorsError.message);
      return;
    }

    const factor = factors.totp.find(f => f.status === 'verified');
    if (!factor) {
      setLoading(false);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่พบข้อมูลการยืนยันตัวตนสองขั้นตอนของบัญชีนี้');
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) {
      setLoading(false);
      Alert.alert('เกิดข้อผิดพลาด', challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code,
    });
    setLoading(false);

    if (verifyError) {
      Alert.alert('รหัสไม่ถูกต้อง', 'กรุณาตรวจสอบรหัสจากแอป Authenticator แล้วลองใหม่อีกครั้ง');
      setCode('');
      return;
    }

    // ยืนยันสำเร็จ -> session จะอัปเดตเป็น aal2 อัตโนมัติ แล้ว useProtectedRoute จะพาไปหน้าเลือกโหมดเอง
    router.replace('/mode-switcher');
  };

  const handleCancel = async () => {
    // ถ้าไม่อยากกรอกต่อ ให้ออกจากระบบแล้วกลับไปหน้า login แทนการค้างอยู่ระหว่างขั้นตอน
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.iconBox}>
              <Ionicons name="shield-checkmark" size={40} color="#FF7A30" />
            </View>
          </View>

          <Text style={styles.title}>ยืนยันตัวตนสองขั้นตอน</Text>
          <Text style={styles.subtitle}>กรอกรหัส 6 หลักจากแอป Authenticator ของคุณ</Text>

          <TextInput
            style={styles.codeInput}
            placeholder="000000"
            placeholderTextColor="#D4C5BA"
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            value={code}
            onChangeText={text => setCode(text.replace(/[^0-9]/g, ''))}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.verifyButton, code.length !== CODE_LENGTH && styles.verifyButtonDisabled]}
            onPress={handleVerify}
            disabled={loading || code.length !== CODE_LENGTH}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.verifyButtonText}>ยืนยัน</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={loading}>
            <Text style={styles.cancelText}>ออกจากระบบ / กลับไปหน้าเข้าสู่ระบบ</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  keyboardView: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: { marginBottom: 24 },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FFE8D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#3A2113', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#8B7E74', textAlign: 'center', marginBottom: 32 },
  codeInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 10,
    textAlign: 'center',
    color: '#3A2113',
    marginBottom: 24,
  },
  verifyButton: {
    width: '100%',
    backgroundColor: '#FF7A30',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyButtonDisabled: { backgroundColor: '#D4C5BA', opacity: 0.5 },
  verifyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: '#8B7E74', fontSize: 13, fontWeight: '600' },
});
