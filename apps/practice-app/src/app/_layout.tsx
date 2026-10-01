import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { restoreAccess, suspendAccess, verifyAccess } from '../features/access/session';
import { checkAccessRequest } from '../features/access/request-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true }),
});

export default function TabLayout() {
  useEffect(() => {
    void restoreAccess().then(checkAccessRequest);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void restoreAccess().then(checkAccessRequest); else suspendAccess();
    });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void verifyAccess(); }, 30000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, []);
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5EAD8' } }} />
    </>
  );
}
