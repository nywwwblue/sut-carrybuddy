import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { CustomTabBar } from '@/components/CustomTabBar';

export default function RunnerTabLayout() {
  const router = useRouter();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} onCenterPress={() => router.push('/runner/create-route-post')} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
