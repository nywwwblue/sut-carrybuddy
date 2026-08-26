import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { CustomTabBar } from '@/components/CustomTabBar';


export default function TabLayout() {
  const router = useRouter();

  const handleCreatePress = () => {
    router.push('/orders/create-open-request');
  };

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} onCenterPress={handleCreatePress} />}
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
