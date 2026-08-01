import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * ผูก Supabase Auth session เข้ากับ Expo Router:
 * - ถ้ายังไม่ล็อกอิน แล้วพยายามเข้าหน้านอกกลุ่ม (auth) -> เด้งกลับไป /login
 * - ถ้าล็อกอินอยู่แล้ว แต่ยังอยู่ในกลุ่ม (auth) (เช่นเปิดแอปมาตรง login ทั้งที่ session ยังไม่หมดอายุ)
 *   -> เด้งไปหน้าเลือกโหมดใช้งานแทน
 *
 * คืนค่า `initialized` เพื่อให้ root layout รู้ว่าเช็ค session เสร็จแล้ว ค่อยซ่อน Splash Screen
 */
export function useProtectedRoute() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
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

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/mode-switcher');
    }
  }, [session, initialized, segments, router]); // 👈 เพิ่ม router เข้าไปตรงนี้

  return initialized;
}