import { feedbackOperationId, sendFeedback, type FeedbackDraft } from './feedback-client';
import BackButton from '../../components/back-button';
import AccessScreen from '../access/access-screen';
import AccessDataScreen from '../access/access-data-screen';
import DeleteDataScreen from '../access/delete-data-screen';
import { hasPendingDeletion } from '../access/deletion-client';
import { useAccessRequest } from '../access/request-client';
import { useAccess } from '../access/session';
import CabinetAccountScreen from '../cabinet-account/account-screen';
import { cabinetAccountEnabled } from '../cabinet-account/session';
import privacyContent from './privacy-content.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Organic as C } from '../prototype/theme';

export type SettingsPage = 'settings' | 'reminders' | 'feedback' | 'about' | 'access' | 'access-data' | 'delete-data' | 'privacy' | 'cabinet-account';
const DRAFT = 'daychee.feedback.draft.v1';
const kinds = ['Ошибка', 'Идея', 'Вопрос'] as const;
export default function SettingsScreen({ page, onPage, onBack, backLabel, bottomTabs, reminders, reminderLabel, view, onView, accessManual, accessReturnLabel, onAccessDone, onDeleted }: {
  page: SettingsPage | null; onPage: (page: SettingsPage | null) => void; onBack: () => void; backLabel: string; bottomTabs: ReactNode; reminders: ReactNode;
  accessManual?: boolean; accessReturnLabel?: string; onAccessDone: () => void;
  onDeleted: () => void;
  reminderLabel: string;
  view: 'day' | 'week' | 'calendar'; onView: (view: 'day' | 'week' | 'calendar') => void;
}) {
  const accessBack = useRef<(() => void) | undefined>(undefined);
  const { record } = useAccessRequest();
  const access = useAccess();
  const [deleted, setDeleted] = useState(false), [pendingDeletion, setPendingDeletion] = useState(false);
  useEffect(() => {
    let active = true;
    if (page === 'settings') void hasPendingDeletion().then(value => { if (active) setPendingDeletion(value); }).catch(() => {});
    return () => { active = false; };
  }, [page, record.status, access]);
  const accessStatus = pendingDeletion ? 'Удаление не подтверждено' : access === 'active' && !record.submitted ? 'Доступ по приглашению' : access === 'active' ? 'Доступ подтверждён' : record.status === 'active' ? 'Проверка доступа' : record.status === 'pending' || record.status === 'approved' ? 'Заявка на рассмотрении' : record.status === 'rejected' ? 'Заявка отклонена' : record.status === 'revoked' || record.status === 'signed_out' ? 'Доступ закрыт' : deleted ? 'Данные удалены · заявки нет' : 'Заявки нет на этом устройстве';
  const deletionBack = useRef<(() => void) | undefined>(undefined);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const registerDeletionBack = useCallback((action?: () => void) => { deletionBack.current = action; }, []);
  const [nestedAccess, setNestedAccess] = useState(false);
  const registerAccessBack = useCallback((action?: () => void) => { accessBack.current = action; setNestedAccess(Boolean(action)); }, []);
  const back = () => deletionBusy ? undefined : page === 'delete-data' && deletionBack.current ? deletionBack.current() : page === 'access' && accessBack.current ? accessBack.current() : onBack();
  const [kind, setKind] = useState<string>('Ошибка'), [message, setMessage] = useState(''), [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  const sending = useRef(false);
  const operation = useRef<FeedbackDraft | null>(null);
  const queue = useRef(Promise.resolve());
  const offsets = useRef<Partial<Record<SettingsPage, number>>>({});
  const pageScroll = useRef<ScrollView>(null);
  const restoringOffset = useRef<number | null>(null);
  useLayoutEffect(() => {
    const y = page ? offsets.current[page] ?? 0 : 0;
    restoringOffset.current = y;
    const frame = requestAnimationFrame(() => pageScroll.current?.scrollTo({ y, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [page]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(DRAFT).then(raw => {
      if (!active || !raw) return;
      const draft = JSON.parse(raw);
      setKind(kinds.includes(draft.kind) ? draft.kind : 'Ошибка');
      setMessage(typeof draft.message === 'string' ? draft.message : '');
      setContact(typeof draft.contact === 'string' ? draft.contact : '');
      if (typeof draft.operationId === 'string') operation.current = draft;
    }).catch(() => { if (active) setError('Не удалось восстановить черновик.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  function save(next: FeedbackDraft) {
    if (!next.operationId) operation.current = null;
    setSent(false);
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(DRAFT, JSON.stringify(next)));
    void queue.current.catch(() => setError('Не удалось сохранить черновик. Текст остаётся на экране.'));
  }
  async function submitFeedback() {
    if (!ready || sending.current) return;
    setError('');
    if (message.trim().length < 2) { setError('Напишите хотя бы пару слов — без текста сообщение не отправить.'); return; }
    sending.current = true; setBusy(true);
    const draft = operation.current ?? { kind, message, contact, operationId: feedbackOperationId(), version };
    operation.current = draft;
    try {
      save(draft);
      await queue.current;
      await sendFeedback(draft);
      // Keep the operation in storage until clearing succeeds, so a restart cannot duplicate delivery.
      await AsyncStorage.setItem(DRAFT, JSON.stringify({ kind, message: '', contact: '' }));
      operation.current = null; setMessage(''); setContact(''); setSent(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось отправить. Черновик сохранён.'); }
    finally { sending.current = false; setBusy(false); }
  }
  const button = (label: string, action: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button"
    accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[s.button, primary && s.primary, disabled && { opacity: 0.5 }]}>
    <Text style={[s.link, primary && { color: C.white }]}>{label}</Text></Pressable>;
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  return <Modal visible={page !== null} animationType="slide" presentationStyle={Platform.OS === 'ios' && Platform.isPad ? 'pageSheet' : 'fullScreen'} onRequestClose={back}>
    <SafeAreaProvider><SafeAreaView edges={Platform.OS === 'ios' && Platform.isPad ? ['top', 'bottom'] : ['top']} style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackButton label={nestedAccess && page === 'access' && !accessManual ? 'Заявка на доступ' : backLabel} disabled={deletionBusy} onPress={back} />
      <ScrollView key={page} ref={pageScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}
        onContentSizeChange={() => { if (restoringOffset.current !== null) pageScroll.current?.scrollTo({ y: restoringOffset.current, animated: false }); }}
        onScrollBeginDrag={() => { restoringOffset.current = null; }}
        onScroll={event => {
          const y = event.nativeEvent.contentOffset.y;
          // Metadata arrives asynchronously. Keep the desired offset when the first,
          // shorter layout clamps it, then restore after the complete card is laid out.
          if (restoringOffset.current !== null && Math.abs(y - restoringOffset.current) > 1) return;
          restoringOffset.current = null;
          if (page) offsets.current[page] = y;
        }} scrollEventThrottle={16}>
        {!['access', 'access-data', 'delete-data', 'cabinet-account'].includes(page ?? '') && <Text accessibilityRole="header" style={s.title}>{page === 'settings' ? 'Настройки' : page === 'reminders' ? 'Напоминания' : page === 'feedback' ? 'Обратная связь' : page === 'about' ? 'О приложении' : 'Политика приватности'}</Text>}
        {page === 'settings' && <>
          {cabinetAccountEnabled && <View style={s.group}><Pressable accessibilityRole="button" onPress={() => onPage('cabinet-account')} style={s.row}><Text style={s.body}>Аккаунт школы</Text><Text style={s.link}>›</Text></Pressable></View>}
          <View style={s.group}>{([['reminders', 'Напоминания', 'bell', 'notifications', reminderLabel], ['feedback', 'Обратная связь', 'bubble.left', 'chat', 'Ошибка, идея или вопрос'], ['about', 'О приложении', 'info.circle', 'info', '']] as const).map(([key, label, ios, android, caption]) =>
            <Pressable key={key} accessibilityRole="button" onPress={() => onPage(key)} style={[s.row, s.iconRow]}><SymbolView name={{ ios, android, web: android }} size={22} tintColor={C.accentDark} /><View style={s.rowText}><Text style={s.body}>{label}</Text>{!!caption && key !== 'reminders' && <Text style={s.caption}>{caption}</Text>}</View>{key === 'reminders' && <Text style={s.caption}>{caption}</Text>}<Text style={s.link}>›</Text></Pressable>)}</View>
          <Text style={s.caption}>Доступ и мои данные</Text>
          <View style={s.group}><Pressable accessibilityRole="button" onPress={() => onPage('access-data')} style={[s.row, s.iconRow]}><SymbolView name={{ ios: 'key', android: 'key', web: 'key' }} size={22} tintColor={C.accentDark} /><View style={s.rowText}><Text style={s.body}>Доступ и мои данные</Text><Text style={s.caption}>{accessStatus}</Text></View><Text style={s.link}>›</Text></Pressable></View>
          <Text style={s.caption}>Политика приватности</Text>
          <View style={s.group}><Pressable accessibilityRole="button" onPress={() => onPage('privacy')} style={[s.row, s.iconRow]}><SymbolView name={{ ios: 'shield', android: 'shield', web: 'shield' }} size={22} tintColor={C.accentDark} /><View style={s.rowText}><Text style={s.body}>Политика приватности</Text><Text style={s.caption}>Открывается без входа</Text></View><Text style={s.link}>›</Text></Pressable></View>
          <Text style={s.caption}>Вид расписания</Text>
          <View style={s.options}>{([['day', 'День'], ['week', 'Неделя'], ['calendar', 'Календарь']] as const).map(([key, label]) =>
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: key === view }} onPress={() => onView(key)} style={[s.button, view === key && s.selected]}><Text style={s.link}>{label}</Text></Pressable>)}</View>
          <Text style={s.caption}>Дейчи · версия {version} · бета</Text>
        </>}
        {page === 'cabinet-account' && cabinetAccountEnabled && <CabinetAccountScreen />}
        {page === 'reminders' && reminders}
        {page === 'about' && <>
          <View style={s.group}><View style={s.row}><Text style={s.body}>Версия</Text><Text style={s.caption}>{version} ({Application.nativeBuildVersion ?? '—'})</Text></View><Pressable accessibilityRole="button" style={s.row} onPress={() => onPage('privacy')}><Text style={s.body}>Политика приватности</Text><Text style={s.link}>›</Text></Pressable></View>
          <Text style={s.brand}>Дейчи</Text><Text style={s.body}>Расписание школы, выбранные занятия и материалы для практики.</Text>
          <View style={s.panel}><Text style={s.heading}>Станислав Лео</Text><Text style={s.caption}>Автор и развитие приложения</Text></View>
          <View style={s.panel}><Text style={s.heading}>Роман Козырец</Text><Text style={s.caption}>Сбор и подготовка индекса материалов вики</Text></View>
          <Text style={s.caption}>Учебные материалы принадлежат их авторам. Версия {version}.</Text>
          {button('Обратная связь', () => onPage('feedback'))}
        </>}
        {page === 'privacy' && <>
          {privacyContent.map((block, index) => <View key={index} style={block.draft ? s.panel : undefined}><Text selectable accessibilityRole={block.kind === 'h2' ? 'header' : undefined} style={block.kind === 'h2' ? s.heading : s.body}>{block.kind === 'li' ? '• ' : ''}{block.text}</Text></View>)}
          {button('Написать на dev@mypraxis.ai', () => void Linking.openURL('mailto:dev@mypraxis.ai').catch(() => setError('Не удалось открыть почту. Адрес: dev@mypraxis.ai')))}
          {!!error && <Text accessibilityRole="alert" style={s.caption}>{error}</Text>}
        </>}
        {page === 'access-data' && <AccessDataScreen onRequest={() => onPage('access')} onPrivacy={() => onPage('privacy')} onDelete={() => onPage('delete-data')} />}
        {page === 'delete-data' && <DeleteDataScreen onBusy={setDeletionBusy} onComplete={() => { setDeleted(true); onDeleted(); }} onCancel={onBack} onBackAction={registerDeletionBack} />}
        {page === 'access' && <><AccessScreen embedded initialManual={accessManual} onBackAction={registerAccessBack} returnLabel={accessReturnLabel ?? 'Готово'} onDone={onAccessDone} onCancel={onBack} />
          {button('Как используются эти данные', () => onPage('privacy'))}
          {button('Доступ и мои данные', () => onPage('access-data'))}
        </>}
        {page === 'feedback' && <>
          <Text style={s.body}>Ошибка, идея или вопрос</Text>
          <View style={s.options}>{kinds.map(value => <Pressable key={value} disabled={!ready || busy} accessibilityRole="button" accessibilityState={{ selected: kind === value }}
            onPress={() => { setKind(value); save({ kind: value, message, contact }); }} style={[s.button, kind === value && s.selected]}><Text style={s.link}>{value}</Text></Pressable>)}</View>
          <Text style={s.heading}>Сообщение</Text>
          <TextInput accessibilityLabel="Сообщение" editable={ready && !busy} multiline maxLength={3000} value={message} placeholder="Что произошло или что хочется улучшить?" placeholderTextColor="#82796A" textAlignVertical="top"
            onChangeText={value => { setMessage(value); save({ kind, message: value, contact }); }} style={[s.input, { minHeight: 160 }]} />
          <Text style={s.heading}>Контакт для ответа · необязательно</Text>
          <TextInput accessibilityLabel="Контакт для ответа" editable={ready && !busy} maxLength={200} value={contact} autoCapitalize="none" placeholder="Telegram или email" placeholderTextColor="#82796A"
            onChangeText={value => { setContact(value); save({ kind, message, contact: value }); }} style={s.input} />
          <Text style={s.caption}>Сообщение получит организатор. Автоматически добавляется только версия приложения. Черновик хранится на этом устройстве.</Text>
          {sent && <Text accessibilityLiveRegion="polite" style={s.body}>Спасибо! Сообщение отправлено.</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || busy, busy }} disabled={!ready || busy} onPress={() => void submitFeedback()} style={[s.button, s.primary]}><Text style={[s.link, { color: C.white }]}>{busy ? 'Отправляем…' : 'Отправить'}</Text></Pressable>
          {!!error && <Text accessibilityRole="alert" style={s.link}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={!ready || busy} onPress={() => { setMessage(''); setContact(''); setError(''); save({ kind, message: '', contact: '' }); }} style={s.button}><Text style={s.link}>Очистить черновик</Text></Pressable>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>{page === 'delete-data' ? null : bottomTabs}</SafeAreaView></SafeAreaProvider>
  </Modal>;
}
const s = StyleSheet.create({
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  safe: { flex: 1, backgroundColor: C.background }, flex: { flex: 1 }, page: { padding: 16, paddingBottom: 40, gap: 18, maxWidth: 600, width: '100%', alignSelf: 'center' },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '700', color: C.text }, brand: { fontSize: 36, fontWeight: '700', color: C.text },
  heading: { fontSize: 17, fontWeight: '600', color: C.text }, body: { fontSize: 17, lineHeight: 25, color: C.text }, caption: { fontSize: 14, lineHeight: 21, color: '#645C50' },
  group: { borderRadius: 20, backgroundColor: C.neutral100, overflow: 'hidden' }, row: { padding: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  rowText: { flex: 1 },
  iconRow: { gap: 12 },
  panel: { backgroundColor: C.neutral100, borderRadius: 20, padding: 16, gap: 8 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, padding: 12, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: C.divider },
  primary: { backgroundColor: '#B2622D', borderColor: '#B2622D' }, selected: { backgroundColor: '#FFE1D0', borderColor: C.accentBorder }, link: { fontSize: 16, fontWeight: '600', color: C.accentDark, textAlign: 'center' },
  input: { borderRadius: 18, padding: 14, backgroundColor: C.neutral100, borderWidth: 1, borderColor: C.neutral300, color: C.text, fontSize: 17, lineHeight: 24 },
});
