import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('กรอกไม่ครบ', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('รหัสผ่านสั้นเกินไป', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('รหัสผ่านไม่ตรงกัน', 'กรุณายืนยันรหัสผ่านใหม่ให้ตรงกัน');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('รหัสผ่านซ้ำเดิม', 'กรุณาตั้งรหัสผ่านใหม่ที่ไม่ซ้ำกับรหัสผ่านเดิม');
      return;
    }

    setLoading(true);

    // ยืนยันตัวตนด้วยรหัสผ่านเดิมก่อน กันกรณีมือถือหลุดมือแล้วมีคนอื่นมากดเปลี่ยนรหัสแทน
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) {
      setLoading(false);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่พบอีเมลของบัญชีนี้ กรุณาลองเข้าสู่ระบบใหม่');
      return;
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      setLoading(false);
      Alert.alert('รหัสผ่านเดิมไม่ถูกต้อง', 'กรุณาตรวจสอบรหัสผ่านปัจจุบันอีกครั้ง');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      Alert.alert('เปลี่ยนรหัสผ่านไม่สำเร็จ', updateError.message);
      return;
    }

    Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', [{ text: 'ตกลง', onPress: () => router.back() }]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScreenHeader title="เปลี่ยนรหัสผ่าน" />

        <View style={styles.card}>
          <Text style={styles.label}>รหัสผ่านปัจจุบัน</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="กรอกรหัสผ่านปัจจุบัน"
              placeholderTextColor="#D4C5BA"
              secureTextEntry={!showCurrent}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(!showCurrent)}>
              <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color="#8B7E74" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>รหัสผ่านใหม่</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              placeholderTextColor="#D4C5BA"
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
              <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color="#8B7E74" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>ยืนยันรหัสผ่านใหม่</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              placeholderTextColor="#D4C5BA"
              secureTextEntry={!showNew}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>บันทึกรหัสผ่านใหม่</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  card: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#3A2113', marginBottom: 8, marginTop: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8D6',
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 14,
    color: '#3A2113',
  },
  eyeBtn: {
    padding: 10,
  },
  submitButton: {
    backgroundColor: '#FF7A30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  forgotLink: { alignItems: 'center', marginTop: 16 },
  forgotLinkText: { color: '#FF7A30', fontWeight: '600', fontSize: 13 },
});
