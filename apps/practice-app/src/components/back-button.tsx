import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Organic as C } from '../features/prototype/theme';

export default function BackButton({ label = 'Назад', onPress }: { label?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label === 'Назад' ? label : `Назад: ${label}`} onPress={onPress} style={s.button}>
    <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={24} tintColor={C.accentDark} />
    <Text style={s.label}>{label}</Text>
  </Pressable>;
}
const s = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', gap: 2, alignItems: 'center', alignSelf: 'flex-start' },
  label: { fontSize: 17, color: C.accentDark },
});
