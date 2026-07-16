import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.includes('@g.sut.ac.th') && !email.includes('@sut.ac.th')) {
      Alert.alert('ส่งลิงก์ไม่สำเร็จ', 'กรุณาใช้อีเมลมหาวิทยาลัย (@sut.ac.th หรือ @g.sut.ac.th) เท่านั้น');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert('ส่งลิงก์ไม่สำเร็จ', error.message);
      return;
    }
    setSent(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="cube" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>SUT CarryBuddy</Text>
          <Text style={styles.subtitle}>รีเซ็ตรหัสผ่านบัญชีของคุณ</Text>
        </View>

        <View style={styles.card}>
          {sent ? (
            <View style={styles.successBox}>
              <Ionicons name="mail-open" size={40} color="#FF7A30" />
              <Text style={styles.successTitle}>ส่งลิงก์รีเซ็ตแล้ว</Text>
              <Text style={styles.successDesc}>
                ตรวจสอบอีเมล {email} แล้วกดลิงก์เพื่อตั้งรหัสผ่านใหม่
              </Text>
              <TouchableOpacity style={styles.submitButton} onPress={() => router.replace('/login')}>
                <Text style={styles.submitButtonText}>กลับไปหน้าเข้าสู่ระบบ</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>อีเมลมหาวิทยาลัย</Text>
              <TextInput
                style={styles.input}
                placeholder="6xxxxxxxx@g.sut.ac.th"
                placeholderTextColor="#D4C5BA"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSend} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>ส่งลิงก์รีเซ็ตรหัสผ่าน</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>ย้อนกลับ</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 30 },
  logo: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#FF7A30',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#3A2113' },
  subtitle: { fontSize: 13, color: '#8B7E74', marginTop: 4 },
  card: {
    marginHorizontal: 24, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#3A2113', marginBottom: 8 },
  input: {
    backgroundColor: '#FFE8D6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: '#3A2113', marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#FF7A30', borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  backLink: { alignItems: 'center', marginTop: 24 },
  backLinkText: { color: '#FF7A30', fontWeight: '600', fontSize: 14 },
  successBox: { alignItems: 'center', gap: 8 },
  successTitle: { fontSize: 18, fontWeight: 'bold', color: '#3A2113', marginTop: 8 },
  successDesc: { fontSize: 13, color: '#8B7E74', textAlign: 'center', marginBottom: 16 },
});
