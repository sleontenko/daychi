import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../components/back-button';
import CabinetAccountScreen from '../features/cabinet-account/account-screen';
import { cabinetAccountEnabled } from '../features/cabinet-account/session';

export default function CabinetAccountRoute() {
  const router = useRouter();
  if (!cabinetAccountEnabled) return <Redirect href="/" />;
  return <SafeAreaView style={s.safe}><BackButton label="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <ScrollView contentContainerStyle={s.page}><CabinetAccountScreen /></ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F5EAD8' },
  page: { padding: 16, paddingBottom: 40, maxWidth: 600, width: '100%', alignSelf: 'center' } });
