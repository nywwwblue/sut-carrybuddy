import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * ผูก Supabase Auth session เข้ากับ Expo Router:
 * - ถ้ายังไม่ล็อกอิน แล้วพยายามเข้าหน้านอกกลุ่ม (auth) -> เด้งกลับไป /login
 * - ถ้าล็อกอินแล้วแต่บัญชีเปิดใช้ 2FA (TOTP) ไว้ และ session ยังไม่ผ่านขั้นตอนที่สอง (aal ยังไม่ถึง aal2)
 *   -> เด้งไปหน้ากรอกรหัส 2FA (/mfa-verify) ก่อนเสมอ ไม่ว่าจะพยายามเข้าหน้าไหนก็ตาม
 * - ถ้าล็อกอินอยู่แล้วและผ่าน 2FA ครบแล้ว แต่ยังอยู่ในกลุ่ม (auth) (เช่นเปิดแอปมาตรง login ทั้งที่ session ยังไม่หมดอายุ)
 *   -> เด้งไปหน้าเลือกโหมดใช้งานแทน
 *
 * คืนค่า `initialized` เพื่อให้ root layout รู้ว่าเช็ค session + AAL เสร็จแล้ว ค่อยซ่อน Splash Screen
 */
export function useProtectedRoute() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [aalChecked, setAalChecked] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialized(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // เช็คว่า session ปัจจุบันต้องผ่านขั้นตอน 2FA (aal2) เพิ่มอีกหรือไม่
  // currentLevel = ระดับของ session ตอนนี้, nextLevel = ระดับสูงสุดที่บัญชีนี้ทำได้ (aal2 ถ้ามี factor ที่ verified แล้ว)
  useEffect(() => {
    if (!session) {
      setNeedsMfa(false);
      setAalChecked(true);
      return;
    }

    let cancelled = false;
    setAalChecked(false);
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setNeedsMfa(false);
      } else {
        setNeedsMfa(data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel);
      }
      setAalChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!initialized || !aalChecked) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inMfaVerifyScreen = inAuthGroup && segments[1] === 'mfa-verify';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && needsMfa && !inMfaVerifyScreen) {
      router.replace('/mfa-verify');
    } else if (session && !needsMfa && inAuthGroup) {
      router.replace('/mode-switcher');
    }
  }, [session, needsMfa, aalChecked, initialized, segments, router]);

  return initialized && aalChecked;
}
