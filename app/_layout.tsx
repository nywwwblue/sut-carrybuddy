import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // บังคับเปลี่ยนจุดเริ่มต้น (Initial Route) จาก (tabs) ให้เป็นหน้า login เสมอ
  initialRouteName: "(auth)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const sessionReady = useProtectedRoute();

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && sessionReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, sessionReady]);

  if (!loaded || !sessionReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
       
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(runner-tabs)" />

        
        <Stack.Screen name="flash/flash-controller" />
        <Stack.Screen name="flash/flash-live" />
        <Stack.Screen name="flash/flash-order" />

        
        <Stack.Screen name="orders/create-open-request" />
        <Stack.Screen name="orders/create-order" />
        <Stack.Screen name="orders/my-requests" />
        <Stack.Screen name="orders/order-detail" />
        <Stack.Screen name="orders/order-history" />
        <Stack.Screen name="orders/order-task-list" />

        
        <Stack.Screen name="payment/checkout" />
        <Stack.Screen name="payment/payment-methods" />
        <Stack.Screen name="payment/wallet" />

      
        <Stack.Screen name="runner/runner-home" />
        <Stack.Screen name="runner/runner-earnings" />
        <Stack.Screen name="runner/create-route-post" />
        <Stack.Screen name="runner/route-pooling-filter" />
        <Stack.Screen name="runner/open-requests-board" />
        <Stack.Screen name="runner/my-posts-management" />


        <Stack.Screen name="chat-detail/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="qr-scanner" />
        <Stack.Screen name="rate-rider" />
        <Stack.Screen name="rider-details" />
        <Stack.Screen name="store-detail" />
        <Stack.Screen name="search-results" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="about" options={{ presentation: 'modal' }} />
        <Stack.Screen name="terms" options={{ presentation: 'modal' }} />
        <Stack.Screen name="privacy-policy" options={{ presentation: 'modal' }} />
        <Stack.Screen name="mode-switcher" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="shopping-list" options={{ title: 'ใบงานรวม', headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}