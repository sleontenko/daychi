import { useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AccessScreen from '../features/access/access-screen';
import { clearInvitation, getInvitation, subscribeInvitation } from '../features/access/invitation-link';
export default function Invitation() {
  const invitation = useSyncExternalStore(subscribeInvitation, getInvitation, () => undefined);
  const router = useRouter();
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#F5EAD8' }}><AccessScreen invitation={invitation} onDone={() => { clearInvitation(); router.replace('/'); }} /></SafeAreaView>;
}
