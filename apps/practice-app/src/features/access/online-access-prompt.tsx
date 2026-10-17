import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { loadAccessRequest, useAccessRequest } from './request-client';
import { useAccess } from './session';
import { Organic as C } from '../prototype/theme';

export default function OnlineAccessPrompt({ onPress, heading = 'Онлайн-ссылка доступна участникам группы' }: { onPress: () => void; heading?: string }) {
  const { record } = useAccessRequest();
  const access = useAccess();
  useEffect(() => { void loadAccessRequest(); }, []);
  const pending = record.status === 'pending' || record.status === 'approved';
  const label = access === 'loading' ? 'Проверяем доступ…' : pending ? 'Статус заявки' : record.status === 'rejected' ? 'Подать новую заявку' : 'Запросить доступ';
  return <View style={s.panel}>
    <View style={s.headingRow}><View style={s.icon}><SymbolView name={{ ios: 'lock', android: 'lock', web: 'lock' }} size={20} tintColor={C.sageDeep} /></View><Text style={s.heading}>{heading}</Text></View>
    {access === 'offline' && <Text style={s.body}>Для проверки доступа нужен интернет.</Text>}
    {pending && <Text style={s.body}>Заявка на рассмотрении у организатора.</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: access === 'loading' }} disabled={access === 'loading'} onPress={onPress} style={s.button}><Text style={s.label}>{label}</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({
  panel: { padding: 20, borderRadius: 24, backgroundColor: C.neutral100, gap: 12 }, headingRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.sageSoft, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontSize: 17, fontWeight: '700', lineHeight: 23, color: C.text }, body: { fontSize: 15, lineHeight: 22, color: C.text },
  button: { minHeight: 50, borderRadius: 999, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B2622D' }, label: { fontSize: 17, fontWeight: '600', color: C.white },
});
