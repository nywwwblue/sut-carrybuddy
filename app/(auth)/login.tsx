import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.includes('@g.sut.ac.th') && !email.includes('@sut.ac.th')) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', 'กรุณาใช้อีเมลมหาวิทยาลัย (@sut.ac.th หรือ @g.sut.ac.th) เท่านั้น');
      return;
    }
    if (!password) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', 'กรุณากรอกรหัสผ่าน');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', error.message);
      return;
    }
    router.replace('/mode-switcher'); // ล็อกอินผ่านแล้วให้ไปเลือกโหมดการใช้งานก่อน
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          
          {/* ส่วนหัว Logo จำลอง */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Ionicons name="cube" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>SUT CarryBuddy</Text>
            <Text style={styles.brandSub}>ฝากหิ้ว รับหิ้ว ในรั้ว SUT</Text>
          </View>

          {/* ฟอร์มกรอกข้อมูล */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>อีมลมหาวิทยาลัย</Text>
              <TextInput 
                style={styles.input}
                placeholder="b6500xxx@g.sut.ac.th"
                placeholderTextColor="#8B7E74"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>รหัสผ่าน</Text>
              <TextInput 
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#8B7E74"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotText}>ลืมรหัสผ่าน?</Text>
              </TouchableOpacity>
            </View>

            {/* ปุ่มเข้าสู่ระบบ */}
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ปุ่มสมัครสมาชิกท้ายหน้า */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>ยังไม่มีบัญชี? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerText}>สมัครสมาชิก</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF', // โทน Warm Ivory ตาม Figma
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: '#FF7A30', // สีส้มแบรนด์
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  brandSub: {
    fontSize: 14,
    color: '#8B7E74',
    marginTop: 4,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, // ความโค้งมน 16px ตาม Spec
    padding: 24,
    gap: 20,
    shadowColor: '#3A2113',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  input: {
    backgroundColor: '#FFF8EF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#3A2113',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotText: {
    color: '#FF7A30',
    fontSize: 13,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#FF7A30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#8B7E74',
    fontSize: 14,
  },
  registerText: {
    color: '#FF7A30',
    fontSize: 14,
    fontWeight: 'bold',
  },
});