import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Organic as C } from '../prototype/theme';
import { logoutAccess, redeemInvitation, restoreAccess, useAccess } from './session';
export default function AccessScreen({ invitation, onDone }: { invitation?: string; onDone?: () => void }) {
  const status = useAccess();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось проверить доступ.'); }
    finally { setBusy(false); }
  }
  return <View style={s.page}>
    <Text accessibilityRole="header" style={s.title}>{status === 'active' ? 'Доступ открыт' : invitation ? 'Приглашение в Дейчи' : 'Доступ по приглашению'}</Text>
    <Text style={s.body}>{status === 'active' ? 'Вики и подключения к занятиям доступны на этом телефоне. Для другого телефона попросите отдельное приглашение.' : status === 'offline' ? 'Для закрытых материалов нужен интернет. Подключитесь, чтобы проверить доступ.' : 'Откройте персональную ссылку от организатора. Она действует 7 дней и используется один раз. Пароль и анкета не нужны.'}</Text>
    {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
    {invitation && status !== 'active' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(() => redeemInvitation(invitation))} style={s.button}><Text style={s.label}>{busy ? 'Проверяем…' : 'Получить доступ'}</Text></Pressable>}
    {!invitation && status !== 'active' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(restoreAccess)} style={s.button}><Text style={s.label}>Проверить доступ</Text></Pressable>}
    {status === 'active' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(logoutAccess)} style={s.button}><Text style={s.label}>Выйти на этом телефоне</Text></Pressable>}
    {status === 'active' && <Text style={s.body}>После выхода потребуется новое приглашение.</Text>}
    {onDone && <Pressable accessibilityRole="button" onPress={onDone} style={s.button}><Text style={s.label}>К расписанию</Text></Pressable>}
  </View>;
}
const s = StyleSheet.create({ page: { padding: 20, gap: 18 }, title: { fontSize: 30, fontWeight: '700', color: C.text }, body: { fontSize: 17, lineHeight: 25, color: C.text }, button: { minHeight: 48, padding: 14, borderRadius: 99, backgroundColor: '#B2622D' }, label: { fontSize: 17, fontWeight: '600', color: C.white, textAlign: 'center' } });
