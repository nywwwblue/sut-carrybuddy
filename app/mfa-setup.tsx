import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';

const CODE_LENGTH = 6;

type ViewState = 'loading' | 'disabled' | 'enrolling' | 'enabled';

export default function MfaSetupScreen() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  // เช็คสถานะ MFA ปัจจุบันของบัญชี ทุกครั้งที่กลับมาหน้านี้
  const loadStatus = useCallback(async () => {
    setState('loading');
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      Alert.alert('เกิดข้อผิดพลาด', error.message);
      setState('disabled');
      return;
    }

    const verifiedTotp = data.totp.find(f => f.status === 'verified');
    if (verifiedTotp) {
      setFactorId(verifiedTotp.id);
      setState('enabled');
      return;
    }

    // ลบ factor เก่าที่ enroll ค้างไว้แต่ไม่เคยยืนยันสำเร็จ กันชนกับการ enroll ใหม่
    const staleFactors = data.totp.filter(f => f.status !== 'verified');
    for (const stale of staleFactors) {
      await supabase.auth.mfa.unenroll({ factorId: stale.id });
    }

    setFactorId(null);
    setState('disabled');
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  const handleStartEnroll = async () => {
    setBusy(true);

    // เคลียร์ factor ที่ enroll ค้างจากรอบก่อน (เช่น กด back ออกไปโดยไม่กดยกเลิก)
    // กันชนกับ error "friendly name already exists" ก่อนสร้างอันใหม่ทุกครั้ง
    const { data: existing } = await supabase.auth.mfa.listFactors();
    if (existing) {
      const stale = existing.totp.filter(f => f.status !== 'verified');
      for (const s of stale) {
        await supabase.auth.mfa.unenroll({ factorId: s.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      // ตั้งชื่อไม่ซ้ำกันทุกครั้งที่ enroll กันชนกับชื่อเดิมที่อาจหลงเหลืออยู่
      friendlyName: `totp-${Date.now()}`,
    });
    setBusy(false);

    if (error) {
      Alert.alert('เปิดใช้งานไม่สำเร็จ', error.message);
      return;
    }

    setFactorId(data.id);
    setQrUri(data.totp.uri);
    setSecret(data.totp.secret);
    setCode('');
    setState('enrolling');
  };

  const handleCancelEnroll = async () => {
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setFactorId(null);
    setQrUri(null);
    setSecret(null);
    setCode('');
    setState('disabled');
  };

  const handleConfirmEnroll = async () => {
    if (!factorId || code.length !== CODE_LENGTH) {
      Alert.alert('กรอกไม่ครบ', `กรุณากรอกรหัส ${CODE_LENGTH} หลักจากแอป Authenticator`);
      return;
    }

    setBusy(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setBusy(false);
      Alert.alert('ยืนยันไม่สำเร็จ', challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);

    if (verifyError) {
      Alert.alert('รหัสไม่ถูกต้อง', 'กรุณาตรวจสอบรหัสจากแอป Authenticator แล้วลองใหม่อีกครั้ง');
      return;
    }

    setQrUri(null);
    setSecret(null);
    setCode('');
    setState('enabled');
    Alert.alert('สำเร็จ', 'เปิดใช้งานการยืนยันตัวตนสองขั้นตอนเรียบร้อยแล้ว');
  };

  const handleDisable = () => {
    if (!factorId) return;
    Alert.alert(
      'ปิดการยืนยันตัวตนสองขั้นตอน',
      'บัญชีของคุณจะปลอดภัยน้อยลง ยืนยันว่าต้องการปิดใช้งานหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ปิดใช้งาน',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.auth.mfa.unenroll({ factorId });
            setBusy(false);
            if (error) {
              Alert.alert('เกิดข้อผิดพลาด', error.message);
              return;
            }
            setFactorId(null);
            setState('disabled');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="ยืนยันตัวตนสองขั้นตอน" subtitle="Two-Factor Authentication" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
        {state === 'loading' && (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#FF7A30" />
          </View>
        )}

        {state === 'disabled' && (
          <>
            <View style={styles.statusRow}>
              <Ionicons name="shield-outline" size={28} color="#8B7E74" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>ยังไม่ได้เปิดใช้งาน</Text>
                <Text style={styles.statusDesc}>
                  เพิ่มความปลอดภัยให้บัญชีด้วยการใช้แอป Authenticator (เช่น Google Authenticator) เป็นขั้นตอนที่สองในการเข้าสู่ระบบ
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartEnroll} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>เปิดใช้งาน</Text>}
            </TouchableOpacity>
          </>
        )}

        {state === 'enrolling' && (
          <>
            <Text style={styles.stepLabel}>1. สแกน QR Code นี้ด้วยแอป Authenticator</Text>
            <View style={styles.qrBox}>
              {qrUri && <QRCode value={qrUri} size={180} />}
            </View>

            {!!secret && (
              <>
                <Text style={styles.stepLabel}>หรือกรอกรหัสนี้ด้วยตนเอง</Text>
                <View style={styles.secretBox}>
                  <Text style={styles.secretText} selectable>{secret}</Text>
                </View>
              </>
            )}

            <Text style={styles.stepLabel}>2. กรอกรหัส 6 หลักจากแอป เพื่อยืนยัน</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor="#D4C5BA"
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              value={code}
              onChangeText={text => setCode(text.replace(/[^0-9]/g, ''))}
            />

            <TouchableOpacity
              style={[styles.primaryButton, code.length !== CODE_LENGTH && styles.primaryButtonDisabled]}
              onPress={handleConfirmEnroll}
              disabled={busy || code.length !== CODE_LENGTH}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>ยืนยันและเปิดใช้งาน</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleCancelEnroll} disabled={busy}>
              <Text style={styles.secondaryButtonText}>ยกเลิก</Text>
            </TouchableOpacity>
          </>
        )}

        {state === 'enabled' && (
          <>
            <View style={styles.statusRow}>
              <Ionicons name="shield-checkmark" size={28} color="#2E9E5B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>เปิดใช้งานอยู่</Text>
                <Text style={styles.statusDesc}>
                  ทุกครั้งที่เข้าสู่ระบบ ระบบจะขอรหัสจากแอป Authenticator ของคุณเพิ่มเติมจากรหัสผ่าน
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.dangerButton} onPress={handleDisable} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.dangerButtonText}>ปิดใช้งาน</Text>}
            </TouchableOpacity>
          </>
        )}
          </View>
        </ScrollView>
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
  centerBox: { paddingVertical: 40, alignItems: 'center' },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statusTitle: { fontSize: 16, fontWeight: 'bold', color: '#3A2113', marginBottom: 4 },
  statusDesc: { fontSize: 13, color: '#8B7E74', lineHeight: 18 },
  stepLabel: { fontSize: 13, fontWeight: '600', color: '#3A2113', marginBottom: 10, marginTop: 12 },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE8D6',
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 4,
  },
  secretBox: {
    backgroundColor: '#FFE8D6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  secretText: { fontSize: 14, fontWeight: '600', color: '#FF7A30', textAlign: 'center', letterSpacing: 1 },
  codeInput: {
    backgroundColor: '#FFE8D6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    color: '#3A2113',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#FF7A30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: { backgroundColor: '#D4C5BA' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: { alignItems: 'center', paddingVertical: 14 },
  secondaryButtonText: { color: '#8B7E74', fontSize: 14, fontWeight: '600' },
  dangerButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dangerButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
