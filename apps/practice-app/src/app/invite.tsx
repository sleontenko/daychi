import { useEffect, useSyncExternalStore } from 'react';
import { BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AccessScreen from '../features/access/access-screen';
import { clearInvitation, getInvitation, subscribeInvitation } from '../features/access/invitation-link';
import { accessReturnLabel, clearAccessReturn, resumeAccessReturn } from '../features/access/return-target';
export default function Invitation() {
  const invitation = useSyncExternalStore(subscribeInvitation, getInvitation, () => undefined);
  const router = useRouter();
  function close() { clearInvitation(); clearAccessReturn(); if (router.canGoBack()) router.back(); else router.replace('/'); }
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { clearInvitation(); clearAccessReturn(); return false; });
    return () => sub.remove();
  }, []);
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#F5EAD8' }}>
    <AccessScreen key={invitation ?? 'manual'} invitation={invitation} onCancel={close} returnLabel={accessReturnLabel() ?? 'Открыть вики'} onDone={() => {
      const resumed = resumeAccessReturn();
      if (!resumed) router.replace('/?tab=wiki'); else close();
      clearInvitation();
    }} />
  </SafeAreaView>;
}
