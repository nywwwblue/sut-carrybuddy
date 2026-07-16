import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_META: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: { active: 'home', inactive: 'home-outline', label: 'หน้าหลัก' },
  map: { active: 'map', inactive: 'map-outline', label: 'แผนที่' },
  chat: { active: 'chatbubbles', inactive: 'chatbubbles-outline', label: 'ข้อความ' },
  profile: { active: 'person', inactive: 'person-outline', label: 'โปรไฟล์' },
};

interface Props extends BottomTabBarProps {
  onCenterPress: () => void;
}

export function CustomTabBar({ state, navigation, onCenterPress }: Props) {
  const renderTab = (routeName: 'index' | 'map' | 'chat' | 'profile') => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const meta = TAB_META[routeName];

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <TouchableOpacity key={route.key} style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name={isFocused ? meta.active : meta.inactive} size={24} color={isFocused ? '#FF7A30' : '#8B7E74'} />
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{meta.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.barRow}>
        {renderTab('index')}
        {renderTab('map')}
        <View style={styles.centerSpacer} />
        {renderTab('chat')}
        {renderTab('profile')}
      </View>
      <TouchableOpacity style={styles.fab} onPress={onCenterPress} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Platform.OS === 'ios' ? 64 : 60,
    paddingBottom: Platform.OS === 'ios' ? 10 : 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: '#8B7E74',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#FF7A30',
    fontWeight: '600',
  },
  centerSpacer: {
    width: 64,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    top: -28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF7A30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7A30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
});
