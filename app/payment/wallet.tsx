import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';

interface Transaction {
  id: string;
  tx_type: 'lock' | 'unlock' | 'earn' | 'refund' | 'topup' | 'withdraw';
  description: string;
  amount: number;
  created_at: string;
}

const TX_LABEL: Record<Transaction['tx_type'], { icon: keyof typeof Ionicons.glyphMap; color: string; positive: boolean }> = {
  lock: { icon: 'lock-closed', color: '#8B7E74', positive: false },
  unlock: { icon: 'lock-open', color: '#2ECC71', positive: true },
  earn: { icon: 'add-circle', color: '#2ECC71', positive: true },
  refund: { icon: 'reload', color: '#4A90E2', positive: true },
  topup: { icon: 'arrow-down-circle', color: '#2ECC71', positive: true },
  withdraw: { icon: 'arrow-up-circle', color: '#FF7A30', positive: false },
};

export default function WalletScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [frozenBalance, setFrozenBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data: walletRow } = await supabase
      .from('wallets')
      .select('id, available_balance, frozen_balance')
      .eq('user_id', userData.user.id)
      .single();

    if (walletRow) {
      setBalance(Number(walletRow.available_balance));
      setFrozenBalance(Number(walletRow.frozen_balance));

      const { data: txRows } = await supabase
        .from('wallet_transactions')
        .select('id, tx_type, description, amount, created_at')
        .eq('wallet_id', walletRow.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txRows) setTransactions(txRows as Transaction[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet])
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ScreenHeader title="Wallet" />

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>ยอดเงินคงเหลือที่ใช้ได้จริง</Text>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceAmount}>฿{balance.toFixed(2)}</Text>
          </View>
          {frozenBalance > 0 && (
            <Text style={styles.frozenText}>ถูกล็อกมัดจำอยู่ ฿{frozenBalance.toFixed(2)}</Text>
          )}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/payment/topup' as any)}>
              <Text style={styles.actionButtonText}>เติมเงิน</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push({ pathname: '/payment/payment-methods', params: { mode: 'withdraw' } })}>
              <Text style={styles.actionButtonText}>ถอนเงิน</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions List */}
        <View style={styles.transactionsContainer}>
          <Text style={styles.sectionTitle}>ประวัติธุรกรรม</Text>
          {loading ? (
            <ActivityIndicator color="#FF7A30" style={{ marginTop: 20 }} />
          ) : transactions.length === 0 ? (
            <EmptyState icon="receipt-outline" title="ยังไม่มีธุรกรรม" />
          ) : (
            transactions.map(transaction => {
              const meta = TX_LABEL[transaction.tx_type];
              const amountValue = Number(transaction.amount);
              return (
                <View key={transaction.id} style={styles.transactionItem}>
                  <View style={[styles.transactionIcon, { backgroundColor: meta.color + '20' }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDescription}>{transaction.description}</Text>
                    <Text style={styles.transactionDate}>{formatDate(transaction.created_at)}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, { color: meta.color }]}>
                    {meta.positive ? '+' : '-'}฿{Math.abs(amountValue).toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.spacer} />
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3A2113',
  },
  placeholder: {
    width: 40,
  },
  balanceCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#FF7A30',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  balanceContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF7A30',
  },
  frozenText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  transactionsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3A2113',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#8B7E74',
    textAlign: 'center',
    marginTop: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A2113',
  },
  transactionDate: {
    fontSize: 11,
    color: '#8B7E74',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  spacer: {
    height: 60,
  },
});
