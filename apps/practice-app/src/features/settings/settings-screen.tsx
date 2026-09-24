import AccessScreen from '../access/access-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Organic as C } from '../prototype/theme';

export type SettingsPage = 'settings' | 'reminders' | 'feedback' | 'about' | 'access';
const DRAFT = 'daychee.feedback.draft.v1';
const kinds = ['Ошибка', 'Идея', 'Вопрос'] as const;
export default function SettingsScreen({ page, onPage, reminders, view, onView }: {
  page: SettingsPage | null; onPage: (page: SettingsPage | null) => void; reminders: ReactNode;
  view: 'day' | 'week' | 'calendar'; onView: (view: 'day' | 'week' | 'calendar') => void;
}) {
  const [kind, setKind] = useState<string>('Ошибка'), [message, setMessage] = useState(''), [contact, setContact] = useState('');
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(DRAFT).then(raw => {
      if (!active || !raw) return;
      const draft = JSON.parse(raw);
      setKind(kinds.includes(draft.kind) ? draft.kind : 'Ошибка');
      setMessage(typeof draft.message === 'string' ? draft.message : '');
      setContact(typeof draft.contact === 'string' ? draft.contact : '');
    }).catch(() => { if (active) setError('Не удалось восстановить черновик.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  function save(next: { kind: string; message: string; contact: string }) {
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(DRAFT, JSON.stringify(next)));
    void queue.current.catch(() => setError('Не удалось сохранить черновик. Текст остаётся на экране.'));
  }
  async function openTelegram() {
    setError(''); setStatus('');
    if (!message.trim()) { setError('Напишите сообщение.'); return; }
    if (busy || !ready) return;
    setBusy(true);
    try {
      save({ kind, message, contact });
      await queue.current;
      const text = `Дейчи · ${kind}\n\n${message.trim()}${contact.trim() ? `\n\nКонтакт: ${contact.trim()}` : ''}`;
      await Linking.openURL(`https://t.me/finleodev_bot?text=${encodeURIComponent(text)}`);
      setStatus('Завершите отправку в Telegram. Если бот открывается впервые, нажмите «Начать». Черновик сохранён здесь; при необходимости скопируйте текст сообщения.');
    } catch { setError('Не удалось открыть Telegram или сохранить черновик. Текст сохранён на экране — попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, action: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button"
    accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[s.button, primary && s.primary, disabled && { opacity: 0.5 }]}>
    <Text style={[s.link, primary && { color: C.white }]}>{label}</Text></Pressable>;
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return <Modal visible={page !== null} animationType="slide" onRequestClose={() => onPage(page === 'settings' ? null : 'settings')}>
    <SafeAreaProvider><SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
        <Pressable accessibilityRole="button" onPress={() => onPage(page === 'settings' ? null : 'settings')} style={s.back}><Text style={s.link}>‹ Назад</Text></Pressable>
        <Text accessibilityRole="header" style={s.title}>{page === 'settings' ? 'Настройки' : page === 'reminders' ? 'Напоминания' : page === 'feedback' ? 'Обратная связь' : page === 'about' ? 'О приложении' : 'Доступ'}</Text>
        {page === 'settings' && <>
          <View style={s.group}>{([['reminders', 'Напоминания'], ['feedback', 'Обратная связь'], ['access', 'Доступ'], ['about', 'О приложении']] as const).map(([key, label]) =>
            <Pressable key={key} accessibilityRole="button" onPress={() => onPage(key)} style={s.row}><Text style={s.body}>{label}</Text><Text style={s.link}>›</Text></Pressable>)}</View>
          <Text style={s.caption}>Вид расписания</Text>
          <View style={s.options}>{([['day', 'День'], ['week', 'Неделя'], ['calendar', 'Календарь']] as const).map(([key, label]) =>
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: key === view }} onPress={() => onView(key)} style={[s.button, view === key && s.selected]}><Text style={s.link}>{label}</Text></Pressable>)}</View>
          <Text style={s.caption}>Дейчи · версия {version} · закрытая бета</Text>
        </>}
        {page === 'reminders' && reminders}
        {page === 'about' && <>
          <Text style={s.brand}>Дейчи</Text><Text style={s.body}>Расписание школы, выбранные занятия и материалы для практики.</Text>
          <View style={s.panel}><Text style={s.heading}>Станислав Лео</Text><Text style={s.caption}>Автор и развитие приложения</Text></View>
          <View style={s.panel}><Text style={s.heading}>Роман Козырец</Text><Text style={s.caption}>Сбор и подготовка индекса материалов вики</Text></View>
          <Text style={s.caption}>Учебные материалы принадлежат их авторам. Версия {version}.</Text>
          {button('Обратная связь', () => onPage('feedback'))}
        </>}
        {page === 'access' && <AccessScreen />}
        {page === 'feedback' && <>
          <Text style={s.body}>Ошибка, идея или вопрос</Text>
          <View style={s.options}>{kinds.map(value => <Pressable key={value} disabled={!ready || busy} accessibilityRole="button" accessibilityState={{ selected: kind === value }}
            onPress={() => { setKind(value); save({ kind: value, message, contact }); }} style={[s.button, kind === value && s.selected]}><Text style={s.link}>{value}</Text></Pressable>)}</View>
          <Text style={s.heading}>Сообщение</Text>
          <TextInput accessibilityLabel="Сообщение" editable={ready && !busy} multiline maxLength={3000} value={message} placeholder="Что произошло или что хочется улучшить?" placeholderTextColor="#82796A" textAlignVertical="top"
            onChangeText={value => { setMessage(value); setStatus(''); save({ kind, message: value, contact }); }} style={[s.input, { minHeight: 160 }]} />
          <Text style={s.heading}>Контакт для ответа · необязательно</Text>
          <TextInput accessibilityLabel="Контакт для ответа" editable={ready && !busy} maxLength={200} value={contact} autoCapitalize="none" placeholder="Telegram или email" placeholderTextColor="#82796A"
            onChangeText={value => { setContact(value); save({ kind, message, contact: value }); }} style={s.input} />
          <Text style={s.caption}>Сообщение откроется в Telegram для @finleodev_bot. Отправку нужно подтвердить там. Черновик хранится на этом устройстве.</Text>
          {!!error && <Text accessibilityRole="alert" style={s.link}>{error}</Text>}
          {!!status && <Text accessibilityLiveRegion="polite" style={s.body}>{status}</Text>}
          <Pressable accessibilityRole="button" disabled={!ready || busy} onPress={() => void openTelegram()} style={[s.button, s.primary]}><Text style={[s.link, { color: C.white }]}>{busy ? 'Открываем Telegram…' : 'Продолжить в Telegram'}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!ready || busy} onPress={() => { setMessage(''); setContact(''); setStatus(''); setError(''); save({ kind, message: '', contact: '' }); }} style={s.button}><Text style={s.link}>Очистить черновик</Text></Pressable>
        </>}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>
  </Modal>;
}
const s = StyleSheet.create({
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  safe: { flex: 1, backgroundColor: C.background }, flex: { flex: 1 }, page: { padding: 16, paddingBottom: 40, gap: 18, maxWidth: 600, width: '100%', alignSelf: 'center' },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '700', color: C.text }, brand: { fontSize: 36, fontWeight: '700', color: C.text },
  heading: { fontSize: 17, fontWeight: '600', color: C.text }, body: { fontSize: 17, lineHeight: 25, color: C.text }, caption: { fontSize: 14, lineHeight: 21, color: '#645C50' },
  group: { borderRadius: 20, backgroundColor: C.neutral100, overflow: 'hidden' }, row: { padding: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  panel: { backgroundColor: C.neutral100, borderRadius: 20, padding: 16, gap: 8 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, padding: 12, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: C.divider },
  primary: { backgroundColor: '#B2622D', borderColor: '#B2622D' }, selected: { backgroundColor: '#FFE1D0', borderColor: C.accentBorder }, link: { fontSize: 16, fontWeight: '600', color: C.accentDark, textAlign: 'center' },
  input: { borderRadius: 18, padding: 14, backgroundColor: C.neutral100, borderWidth: 1, borderColor: C.neutral300, color: C.text, fontSize: 17, lineHeight: 24 },
});
