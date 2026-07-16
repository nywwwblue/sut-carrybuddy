import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, TextInput, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const OTP_LENGTH = 6; // Supabase ส่งรหัสยืนยันอีเมลเป็นเลข 6 หลักโดย default

export default function OTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [timeLeft, setTimeLeft] = useState(432);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<TextInput[]>([]);

  const email = params.email as string || 'b6500xxx@g.sut.ac.th';

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleOtpChange = (text: string, index: number) => {
    if (!/^\d*$/.test(text)) return; // Only numbers

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      Alert.alert('ยืนยันไม่สำเร็จ', `กรุณากรอก OTP ให้ครบ ${OTP_LENGTH} หลัก`);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'signup', // ใช้ 'email' แทนถ้าเป็น flow ยืนยันการเข้าสู่ระบบแทนการสมัครสมาชิก
    });
    setLoading(false);

    if (error) {
      Alert.alert('ยืนยันไม่สำเร็จ', error.message);
      return;
    }
    router.replace('/mode-switcher');
  };

  const handleResend = async () => {
    setIsResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setIsResending(false);

    if (error) {
      Alert.alert('ส่ง OTP ไม่สำเร็จ', error.message);
      return;
    }
    setTimeLeft(432);
    setOtp(Array(OTP_LENGTH).fill(''));
    Alert.alert('สำเร็จ', 'ส่ง OTP ใหม่ไปที่อีเมลของคุณแล้ว');
  };

  const isOtpFilled = otp.every(digit => digit !== '');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#3A2113" />
          </TouchableOpacity>
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconBox}>
            <Ionicons name="mail" size={40} color="#FF7A30" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>ยืนยันรหัส OTP</Text>
        <Text style={styles.subtitle}>กรุณากรอกรหัสยืนยันที่ส่งไปยัง</Text>
        <Text style={styles.subtitleEmail}>อีเมลของคุณ</Text>

        {/* Email Display */}
        <View style={styles.emailBox}>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* OTP Input Fields */}
        <View style={styles.otpContainer}>
          {Array(OTP_LENGTH).fill(0).map((_, index) => (
            <TextInput
              key={index}
              ref={ref => {
                if (ref) inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpInput,
                otp[index] && styles.otpInputFilled
              ]}
              keyboardType="number-pad"
              maxLength={1}
              value={otp[index]}
              onChangeText={text => handleOtpChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              placeholder="-"
              placeholderTextColor="#D4C5BA"
            />
          ))}
        </View>

        {/* Timer */}
        <Text style={styles.timer}>
          สิ้นสุดการเข้าถึงใน <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
        </Text>

        {/* Verify Button */}
        <TouchableOpacity 
          style={[
            styles.verifyButton,
            !isOtpFilled && styles.verifyButtonDisabled
          ]}
          onPress={handleVerify}
          disabled={!isOtpFilled || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.verifyButtonText}>ยืนยัน</Text>
          )}
        </TouchableOpacity>

        {/* Resend Section */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>ไม่ได้รับหรือสิ? </Text>
          <TouchableOpacity 
            onPress={handleResend}
            disabled={isResending || timeLeft > 0}
          >
            <Text style={[
              styles.resendLink,
              (isResending || timeLeft > 0) && styles.resendLinkDisabled
            ]}>
              {isResending ? 'กำลังส่ง...' : 'ส่งรหัสใหม่'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    width: '100%',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FFE8D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A2113',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#8B7E74',
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitleEmail: {
    fontSize: 13,
    color: '#8B7E74',
    textAlign: 'center',
    marginBottom: 16,
  },
  emailBox: {
    backgroundColor: '#FFE8D6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    marginBottom: 32,
  },
  email: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF7A30',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  otpInput: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8D5C4',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  otpInputFilled: {
    borderColor: '#FF7A30',
    backgroundColor: '#FFF8EF',
  },
  timer: {
    fontSize: 13,
    color: '#8B7E74',
    marginBottom: 24,
  },
  timerText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FF7A30',
  },
  verifyButton: {
    width: '100%',
    backgroundColor: '#FF7A30',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    backgroundColor: '#D4C5BA',
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 13,
    color: '#8B7E74',
  },
  resendLink: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FF7A30',
  },
  resendLinkDisabled: {
    color: '#D4C5BA',
  },
});
