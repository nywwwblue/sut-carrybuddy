import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  student_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  avatar_url: string | null;
  role: 'requester' | 'runner' | 'admin';
}

export interface TrustScore {
  trust_score: number;
  punctuality_rate: number;
  effort_rate: number;
  responsibility_rate: number;
  total_carries: number;
  total_orders: number;
}

export interface Wallet {
  available_balance: number;
  frozen_balance: number;
}

/**
 * ดึงข้อมูลโปรไฟล์ + แต้มความน่าเชื่อถือ + กระเป๋าเงินของผู้ใช้ที่ล็อกอินอยู่
 * ใช้ร่วมกันได้ทุกหน้า (Profile, Wallet, Home ฯลฯ) แทนการ query ซ้ำแยกกัน
 */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError(userError?.message ?? 'ไม่พบผู้ใช้ที่ล็อกอินอยู่');
      setLoading(false);
      return;
    }

    const uid = userData.user.id;

    const [profileRes, trustRes, walletRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', uid).single(),
      supabase.from('trust_scores').select('*').eq('user_id', uid).single(),
      supabase.from('wallets').select('available_balance, frozen_balance').eq('user_id', uid).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data as UserProfile);
    if (trustRes.data) setTrustScore(trustRes.data as TrustScore);
    if (walletRes.data) setWallet(walletRes.data as Wallet);

    if (profileRes.error) setError(profileRes.error.message);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, trustScore, wallet, loading, error, refresh: fetchProfile };
}
