import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function EditProfile() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      const { data: profile } = await supabase.from('users').select('name, email, phone, department').eq('id', data.user.id).single();
      if (profile) {
        setFullName(profile.name || '');
        setEmail(profile.email || '');
        setPhone(profile.phone || '');
        setDepartment(profile.department || '');
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    if (!fullName.trim()) {
      Alert.alert('กรอกไม่ครบ', 'กรุณากรอกชื่อ-นามสกุล');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('users').update({ name: fullName, phone, department }).eq('id', userId);
    setSaving(false);

    if (error) {
      Alert.alert('บันทึกไม่สำเร็จ', error.message);
      return;
    }
    Alert.alert('สำเร็จ', 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
    router.back();
  };

  const initials = fullName ? fullName.trim().slice(0, 2) : '..';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FF7A30" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ScreenHeader title="ตั้งค่าโปรไฟล์" />

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarHint}>แตะเพื่ออัปโหลดรูป (เร็วๆ นี้)</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>ชื่อ - นามสกุล</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="กรอกชื่อ - นามสกุล"
              placeholderTextColor="#8B7E74"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>อีเมล</Text>
            <View style={[styles.input, styles.inputDisabled]}>
              <Text style={styles.disabledText}>{email}</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>เบอร์โทรศัพท์</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="กรอกเบอร์โทรศัพท์"
              placeholderTextColor="#8B7E74"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>สาขาวิชา</Text>
            <TextInput
              style={styles.input}
              value={department}
              onChangeText={setDepartment}
              placeholder="กรอกสาขาวิชา"
              placeholderTextColor="#8B7E74"
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>บันทึกการเปลี่ยนแปลง</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFF8EF',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#3A2113' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#FF7A30',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' },
  avatarHint: { fontSize: 12, color: '#8B7E74' },
  formSection: { paddingHorizontal: 20, marginBottom: 24 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#3A2113', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8D5C4', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#3A2113',
  },
  inputDisabled: { backgroundColor: '#F5F0EB' },
  disabledText: { fontSize: 14, color: '#8B7E74' },
  buttonSection: { paddingHorizontal: 20, marginBottom: 32, gap: 12 },
  saveBtn: {
    backgroundColor: '#FF7A30', paddingVertical: 14, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  cancelBtn: { backgroundColor: '#E8D5C4', paddingVertical: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#3A2113', fontWeight: '600', fontSize: 16 },
});
