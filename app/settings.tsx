import React, { useState, ComponentProps } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

interface SettingItemProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}

export default function Settings() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', onPress: () => {} },
      {
        text: 'ออกจากระบบ',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  // ─── แก้ไข: กำหนดไทป์ SettingItemProps เข้าไปที่ตัวรับพารามิเตอร์ ───
  const SettingItem = ({ icon, label, value, onToggle }: SettingItemProps) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={24} color="#FF7A30" />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ScreenHeader title="ตั้งค่า" />

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>บัญชีผู้ใช้</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/edit-profile')}>
            <Ionicons name="person-circle" size={24} color="#FF7A30" />
            <Text style={styles.menuLabel}>แก้ไขโปรไฟล์</Text>
            <Ionicons name="chevron-forward" size={20} color="#8B7E74" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/mode-switcher')}>
            <Ionicons name="swap-horizontal" size={24} color="#FF7A30" />
            <Text style={styles.menuLabel}>สลับโหมด (ผู้ฝาก / ผู้รับหิ้ว)</Text>
            <Ionicons name="chevron-forward" size={20} color="#8B7E74" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="lock-closed" size={24} color="#FF7A30" />
            <Text style={styles.menuLabel}>เปลี่ยนรหัสผ่าน</Text>
            <Ionicons name="chevron-forward" size={20} color="#8B7E74" />
          </TouchableOpacity>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>การแจ้งเตือน</Text>
          <SettingItem
            icon="notifications"
            label="การแจ้งเตือน"
            value={notificationsEnabled}
            onToggle={setNotificationsEnabled}
          />
          <SettingItem
            icon="location"
            label="เข้าถึงตำแหน่ง"
            value={locationEnabled}
            onToggle={setLocationEnabled}
          />
        </View>

        {/* Display Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>การแสดงผล</Text>
          <SettingItem
            icon="moon"
            label="โหมดมืด"
            value={darkMode}
            onToggle={setDarkMode}
          />
          <SettingItem
            icon="wifi-outline"
            label="โหมดออฟไลน์"
            value={offlineMode}
            onToggle={setOfflineMode}
          />
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>เกี่ยวกับแอป</Text>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="information-circle" size={24} color="#FF7A30" />
            <Text style={styles.menuLabel}>เกี่ยวกับ SUT CarryBuddy</Text>
            <Ionicons name="chevron-forward" size={20} color="#8B7E74" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="document-text" size={24} color="#FF7A30" />
            <Text style={styles.menuLabel}>เงื่อนไขการใช้งาน</Text>
            <Ionicons name="chevron-forward" size={20} color="#8B7E74" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="shield-checkmark" size={24} color="#FF7A30" />
            <Text style={styles.menuLabel}>นโยบายความเป็นส่วนตัว</Text>
            <Ionicons name="chevron-forward" size={20} color="#8B7E74" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#FFF8EF" />
            <Text style={styles.logoutText}>ออกจากระบบ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn}>
            <Ionicons name="trash" size={20} color="#FFF8EF" />
            <Text style={styles.deleteText}>ลบบัญชี</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>เวอร์ชัน 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF8EF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A2113',
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B7E74',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E8D5C4',
    gap: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E8D5C4',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#3A2113',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A2113',
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#E74C3C',
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#FFF8EF',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    backgroundColor: '#C0392B',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  deleteText: {
    color: '#FFF8EF',
    fontWeight: '600',
    fontSize: 16,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#8B7E74',
  },
});
