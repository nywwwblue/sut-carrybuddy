import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface FlashSession {
  id: number;
  post_id: number;
  store_name: string;
  expires_at: string;
}

interface FlashBuyBannerProps {
  onPressBanner: (postId: number, sessionData: { runner: string; store: string; time: string }) => void;
}

export default function FlashBuyBanner({ onPressBanner }: FlashBuyBannerProps) {
  const [activeSession, setActiveSession] = useState<FlashSession | null>(null);
  const [runnerName, setRunnerName] = useState('Runner มทส.');
  const [timeLeft, setTimeLeft] = useState<string>('05:00');

  const calculateTimeLeft = (expiryString: string) => {
    const difference = +new Date(expiryString) - +new Date();
    if (difference <= 0) return null;

    const minutes = Math.floor((difference / 1000 / 60) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const fetchActiveSession = async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('flash_buy_sessions')
      .select(`
        id, post_id, expires_at, runner_id,
        store:store_id ( name ),
        custom_location_label
      `)
      .eq('status', 'active')
      .gt('expires_at', now)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const row = data as any;
      const storeName = row.store?.name || row.custom_location_label || 'ร้านค้า มทส.';
      
      setActiveSession({
        id: row.id,
        post_id: row.post_id,
        store_name: storeName,
        expires_at: row.expires_at
      });

      if (row.runner_id) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('name')
          .eq('id', row.runner_id)
          .single();
        if (userProfile) setRunnerName(userProfile.name);
      }
    } else {
      setActiveSession(null);
    }
  };

  useEffect(() => {
    fetchActiveSession();

    const channel = supabase
      .channel('realtime:flash_buy')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flash_buy_sessions' }, () => {
        fetchActiveSession();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!activeSession) return;

    const timer = setInterval(() => {
      const calculated = calculateTimeLeft(activeSession.expires_at);
      if (calculated) {
        setTimeLeft(calculated);
      } else {
        setActiveSession(null);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession]);

  if (!activeSession) return null;

  return (
    <TouchableOpacity
      style={styles.bannerContainer}
      onPress={() => onPressBanner(activeSession.post_id, { runner: runnerName, store: activeSession.store_name, time: timeLeft })}
      activeOpacity={0.9}
    >
      <View style={styles.bannerRow}>
        <View style={styles.leftSection}>
          <View style={styles.titleRow}>
            <Text style={styles.bannerTitle}>Flash Buy</Text>
          </View>
          <Text style={styles.bannerSubtitle} numberOfLines={1}>
            มีคนเปิดรับซื้อด่วนที่ {activeSession.store_name}
          </Text>
        </View>

        <View style={styles.rightSection}>
          <View style={styles.timerCard}>
            <Text style={styles.timerNumber}>{timeLeft}</Text>
            <Text style={styles.timerLabel}>เหลือเวลา</Text>
          </View>
          <Text style={styles.actionText}>แตะเพื่อร่วมสั่งซื้อ</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#FF7A30',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 18,
    shadowColor: '#FF7A30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    opacity: 0.95,
  },
  rightSection: {
    alignItems: 'center',
    gap: 8,
  },
  timerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 90,
  },
  timerNumber: {
    color: '#FF7A30',
    fontSize: 20,
    fontWeight: 'bold',
  },
  timerLabel: {
    color: '#B0A498',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },
});