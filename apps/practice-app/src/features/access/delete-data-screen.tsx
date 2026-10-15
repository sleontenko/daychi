import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { clearSessionAfterDeletion } from './session';
import { clearInvitation } from './invitation-link';
import { clearRequestAfterDeletion, finishRequestDeletion, prepareRequestDeletion, useAccessRequest } from './request-client';
import { deleteAccessData, hasPendingDeletion } from './deletion-client';
import { Organic as C } from '../prototype/theme';

export default function DeleteDataScreen({ onBusy, onComplete, onCancel, onBackAction }: {
  onBusy: (busy: boolean) => void; onComplete: () => void; onCancel: () => void;
  onBackAction: (action?: () => void) => void;
}) {
  const { record } = useAccessRequest();
  const [busy, setBusy] = useState(false), [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const sending = useRef(false);
  const complete = useRef(onComplete);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  useEffect(() => { void hasPendingDeletion().then(setPending).catch(() => setError('Не удалось прочитать запрос удаления.')); }, []);
  useEffect(() => {
    onBackAction(success ? () => complete.current() : busy ? () => {} : undefined);
    return () => onBackAction();
  }, [success, busy, onBackAction]);
  async function remove() {
    if (sending.current) return;
    sending.current = true; setBusy(true); onBusy(true); setError('');
    try {
      await prepareRequestDeletion();
      await deleteAccessData(async () => {
        await clearSessionAfterDeletion();
        await clearRequestAfterDeletion();
        clearInvitation();
      });
      setSuccess(true); setPending(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось подтвердить результат. Повторите тот же запрос.');
      setPending(await hasPendingDeletion().catch(() => true));
    } finally { finishRequestDeletion(); sending.current = false; setBusy(false); onBusy(false); }
  }
  return <View style={s.page}>
    <Text accessibilityRole="header" style={s.title}>{success ? 'Данные удалены' : record.status === 'pending' ? 'Отозвать заявку и удалить данные?' : 'Удалить данные доступа?'}</Text>
    {success ? <>
      <Text style={s.body}>Сервер подтвердил удаление связанных с этим телефоном заявок и доступа. Черновик заявки и сохранённые ключи доступа очищены.</Text>
      <View style={s.kept}><Text style={s.body}>Мои занятия, напоминания и закладки остались на телефоне. Вики и расписание открыты без заявки.</Text></View>
      <ActionButton label="Готово" onPress={onComplete} busy={busy} />
    </> : <>
      <Text style={s.caption}>Удаляется</Text>
      <View style={s.panel}><Text style={s.body}>• С сервера: имя, фамилия и Telegram в заявках, решение, приглашения и связанный доступ, которые подтверждаются сохранёнными ключами этого телефона.{ '\n\n' }• На телефоне: черновик заявки и ключи доступа.</Text></View>
      <Text style={s.caption}>Остаётся на этом телефоне</Text>
      <View style={s.kept}><Text style={s.body}>• Мои занятия{ '\n' }• Напоминания{ '\n' }• Закладки в вики</Text></View>
      <Text style={s.body}>Это не выход из аккаунта. Удаление нельзя отменить. Для онлайн-ссылок понадобится новая заявка. Вики и расписание остаются открытыми.</Text>
      {!!error && <View accessibilityRole="alert" style={s.error}><Text style={s.body}>{error}</Text></View>}
      {busy && <><ActivityIndicator color={C.accentDark} /><Text accessibilityLiveRegion="polite" style={s.caption}>Запрос сохранён. Дождитесь ответа сервера.</Text></>}
      <ActionButton label={busy ? 'Удаляем…' : pending ? 'Повторить тот же запрос' : record.status === 'pending' ? 'Отозвать и удалить' : 'Удалить навсегда'} onPress={() => void remove()} busy={busy} />
      <ActionButton label={pending ? 'Вернуться, повторить позже' : 'Отмена'} onPress={onCancel} busy={busy} secondary />
      {pending && <Text style={s.caption}>Операция и ключи сохраняются до подтверждения. Можно вернуться и повторить позже.</Text>}
    </>}
  </View>;
}
function ActionButton({ label, onPress, busy, secondary = false }: { label: string; onPress: () => void; busy: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onPress} style={[s.button, secondary && s.secondary]}>
    <Text style={[s.label, secondary && { color: C.text }]}>{label}</Text></Pressable>;
}
const s = StyleSheet.create({
  page: { gap: 16 }, title: { fontSize: 26, lineHeight: 31, fontWeight: '700', color: C.text },
  body: { fontSize: 16, lineHeight: 24, color: C.text }, caption: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: '#645C50' },
  panel: { padding: 16, borderRadius: 20, backgroundColor: C.neutral100 }, kept: { padding: 16, borderRadius: 20, backgroundColor: '#EFF5DF' },
  error: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.accentBorder, backgroundColor: C.accentSoft },
  button: { minHeight: 52, borderRadius: 999, padding: 15, justifyContent: 'center', backgroundColor: '#8C491A' },
  secondary: { backgroundColor: C.neutral100, borderWidth: 1.5, borderColor: C.neutral300 },
  label: { color: C.white, fontSize: 17, fontWeight: '600', textAlign: 'center' },
});
