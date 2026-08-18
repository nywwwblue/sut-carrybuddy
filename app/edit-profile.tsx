import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function EditProfile() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newImageBase64, setNewImageBase64] = useState<string | null>(null);
  const [newImageExt, setNewImageExt] = useState<string>('jpg');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      const { data: profile } = await supabase
        .from('users')
        .select('name, email, phone, department, avatar_url')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        setFullName(profile.name || '');
        setEmail(profile.email || '');
        setPhone(profile.phone || '');
        setDepartment(profile.department || '');
        setAvatarUrl(profile.avatar_url || null);
      }
      setLoading(false);
    });
  }, []);

  // ฟังก์ชันเลือกรูปจากคลังภาพ
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('สิทธิ์ถูกปฏิเสธ', 'กรุณาอนุญาตให้แอปเข้าถึงรูปภาพของคุณเพื่อเปลี่ยนรูปโปรไฟล์');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAvatarUrl(asset.uri); // แสดงพรีวิวทันที
      setNewImageBase64(asset.base64 || null);
      
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      setNewImageExt(ext);
    }
  };

  // ฟังก์ชันอัปโหลดภาพขึ้น Supabase Storage
  const uploadAvatar = async (uid: string): Promise<string | null> => {
    if (!newImageBase64) return avatarUrl;

    const fileName = `${uid}-${Date.now()}.${newImageExt}`;
    const filePath = `${uid}/${fileName}`;
    const contentType = `image/${newImageExt === 'jpg' ? 'jpeg' : newImageExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, decode(newImageBase64), {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!fullName.trim()) {
      Alert.alert('กรอกไม่ครบ', 'กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    try {
      setSaving(true);

      let finalAvatarUrl = avatarUrl;
      if (newImageBase64) {
        finalAvatarUrl = await uploadAvatar(userId);
      }

      const { error } = await supabase
        .from('users')
        .update({
          name: fullName,
          phone,
          department,
          avatar_url: finalAvatarUrl,
        })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('สำเร็จ', 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
      router.back();
    } catch (error: any) {
      Alert.alert('บันทึกไม่สำเร็จ', error.message || 'เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setSaving(false);
    }
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
        <ScreenHeader title="ตั้งค่าโปรไฟล์" />

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper} activeOpacity={0.8}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>แตะเพื่อเปลี่ยนรูปโปรไฟล์</Text>
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
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF7A30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8D5C4',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#3A2113',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF8EF',
  },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' },
  avatarHint: { fontSize: 13, color: '#8B7E74', fontWeight: '500' },
  formSection: { paddingHorizontal: 20, marginBottom: 24 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#3A2113', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#3A2113',
  },
  inputDisabled: { backgroundColor: '#F5F0EB' },
  disabledText: { fontSize: 14, color: '#8B7E74' },
  buttonSection: { paddingHorizontal: 20, marginBottom: 32, gap: 12 },
  saveBtn: {
    backgroundColor: '#FF7A30',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  cancelBtn: {
    backgroundColor: '#E8D5C4',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#3A2113', fontWeight: '600', fontSize: 16 },
});