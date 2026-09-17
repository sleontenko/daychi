import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Organic as C } from '../prototype/theme';
import { disablePush, enablePush, isPaired, pairDevice } from './device';

export function ReminderPanel({ choices }: { choices: Record<string, boolean> }) {
  const [paired, setPaired] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Напоминания за 30 минут. Для подключения нужен одноразовый код.');
  useEffect(() => { void isPaired().then(setPaired).catch(() => setMessage('Не удалось прочитать ключ устройства.')); }, []);
  const run = async (disable = false) => {
    if (busy) return;
    setBusy(true);
    try {
      if (disable) { await disablePush(); setMessage('Серверные напоминания отключены.'); }
      else {
        if (!paired) { await pairDevice(code); setPaired(true); setCode(''); }
        await enablePush(choices);
        setMessage('iPhone зарегистрирован. Напоминания за 30 минут; доставка зависит от сети и настроек iOS.');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось подключиться. Повторите.'); }
    finally { setBusy(false); }
  };
  return <View style={s.panel}>
    <Text style={s.title}>Напоминания</Text>
    <Text style={s.copy}>{Platform.OS === 'ios' ? message : 'Подключение уведомлений доступно в приложении на iPhone.'}</Text>
    {Platform.OS === 'ios' && <>
      {!paired && <TextInput accessibilityLabel="Одноразовый код подключения" placeholder="Код подключения"
        value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false}
        secureTextEntry style={s.input} editable={!busy} />}
      <Pressable accessibilityRole="button" disabled={busy || (!paired && code.trim().length < 20)}
        onPress={() => void run()} style={s.button}>
        <Text style={s.buttonText}>{busy ? 'Подключаем…' : paired ? 'Включить / проверить' : 'Подключить iPhone'}</Text>
      </Pressable>
      {paired && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(true)} style={s.off}>
        <Text style={s.copy}>Отключить напоминания</Text>
      </Pressable>}
    </>}
  </View>;
}

const s = StyleSheet.create({
  panel: { marginTop: 32, gap: 12, borderTopWidth: 1, borderColor: C.divider, paddingTop: 24 },
  title: { fontSize: 21, fontWeight: '600', color: C.text },
  copy: { fontSize: 13, lineHeight: 20, color: C.text },
  input: { borderWidth: 1, borderColor: C.divider, padding: 14, borderRadius: 12, color: C.text },
  button: { backgroundColor: C.sageDeep, padding: 14, borderRadius: 24, alignItems: 'center' },
  buttonText: { color: C.white, fontWeight: '600', fontSize: 15 },
  off: { minHeight: 44, justifyContent: 'center' },
});
