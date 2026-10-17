import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { hasDeletionCredentials, hasPendingDeletion } from './deletion-client';
import { checkAccessRequest, loadAccessRequest, useAccessRequest } from './request-client';
import { privateRequest, useAccess } from './session';
import { Organic as C } from '../prototype/theme';

type SessionDetails = { invitation_reference?: string; invitation_label?: string; activated_at?: number | null };
function displayDate(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'Нет сведений';
  try { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' }).format(new Date(value * 1000)); }
  catch { return 'Нет сведений'; }
}
export default function AccessDataScreen({ onRequest, onPrivacy, onDelete }: { onRequest: () => void; onPrivacy: () => void; onDelete: () => void }) {
  const { record, ready, error: requestError } = useAccessRequest();
  const access = useAccess();
  const [proofs, setProofs] = useState<boolean | null>(null), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [details, setDetails] = useState<SessionDetails | null>(null);
  useEffect(() => { void loadAccessRequest().then(() => checkAccessRequest()); }, []);
  useEffect(() => {
    let active = true;
    Promise.all([hasDeletionCredentials(), hasPendingDeletion()]).then(([keys, operation]) => {
      if (active) { setProofs(keys); setPending(operation); }
    }).catch(() => { if (active) setError('Не удалось прочитать ключи удаления. Откройте этот экран снова.'); });
    return () => { active = false; };
  }, [record, ready, access]);
  useEffect(() => {
    let valid = true;
    // The response is authorized for this installation, with no raw credentials.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetails(null);
    if (access === 'active' && !record.submitted) privateRequest<SessionDetails>('/api/access/session')
      .then(value => { if (valid) setDetails(value); })
      .catch(() => { if (valid) setError('Не удалось обновить сведения о приглашении. Повторите открытие экрана.'); });
    return () => { valid = false; };
  }, [access, record.submitted]);
  const button = (label: string, action: () => void, primary = false) => <Pressable accessibilityRole="button" onPress={action} style={[s.button, primary && s.primary]}><Text style={[s.link, primary && { color: C.white }]}>{label}</Text></Pressable>;
  const status = record.status;
  const active = access === 'active';
  const invitation = (active || access === 'offline') && !record.submitted;
  const isPending = status === 'pending' || status === 'approved';
  const closed = status === 'revoked' || status === 'signed_out';
  const text = access === 'offline' ? 'Не удалось проверить доступ. Для закрытых онлайн-ссылок нужен интернет. Вики и расписание открыты без заявки.' : invitation ? 'Доступ открыт по персональному приглашению. Онлайн-ссылки открываются на этом телефоне.' : active ? 'Онлайн-ссылки открываются на этом телефоне.' : isPending ? 'Организатор ещё не принял решение. Вики и расписание открыты без заявки.' : status === 'rejected' ? 'Можно подать новую заявку или удалить данные этой.' : closed ? 'Доступ к онлайн-ссылкам закрыт. Сохранённый ключ позволяет удалить данные доступа.' : 'Вики и расписание открыты без заявки. Заявка нужна для онлайн-ссылок, доступных участникам группы.';
  const rows: [string, string][] = invitation ? [
    ['Имя из приглашения', details?.invitation_label || 'Не указано'],
    ['Приглашение', details?.invitation_reference ? '№ ' + details.invitation_reference : 'Нет сведений'],
    ['Активировано', displayDate(details?.activated_at)],
  ] : record.submitted ? [
    ['Имя и фамилия', (record.profile.first_name + ' ' + record.profile.last_name).trim()],
    ['Telegram', record.profile.telegram ? '@' + record.profile.telegram.replace(/^@/, '') : 'Не указан'],
    ['Заявка', (record.id ? '№ ' + record.id + ' · ' : '') + (active ? 'одобрена' : status === 'active' ? 'требует проверки доступа' : isPending ? 'на рассмотрении' : status === 'rejected' ? 'отклонена' : 'доступ закрыт')],
    [isPending ? 'Отправлена' : 'Решение', displayDate(isPending ? record.created_at : record.decided_at)],
  ] : [];
  if (rows.length || proofs) rows.push(['Ключ удаления на этом телефоне', proofs === null ? 'Проверяем…' : proofs ? 'Сохранён' : 'Нет']);
  const icon = active ? 'checkmark.circle' : isPending ? 'clock' : status === 'rejected' || closed ? 'xmark.circle' : 'person.crop.circle';
  return <View style={s.page}>
    <View style={s.icon}><SymbolView name={{ ios: icon, android: active ? 'check_circle' : isPending ? 'schedule' : 'lock', web: 'lock' }} size={30} tintColor={C.sageDeep} /></View>
    <Text accessibilityRole="header" style={s.title}>{invitation ? 'Доступ по приглашению' : active ? 'Доступ подтверждён' : status === 'active' ? 'Проверка доступа' : isPending ? 'Заявка на рассмотрении' : status === 'rejected' ? 'Заявка отклонена' : closed ? 'Доступ закрыт' : 'Доступ и мои данные'}</Text>
    <Text style={s.body}>{text}</Text>
    {pending && <View style={s.notice}><Text style={s.body}>Удаление не подтверждено. Запрос сохранён на телефоне.</Text>{button('Повторить тот же запрос', onDelete)}</View>}
    {!!rows.length && <View style={{ gap: 6 }}><Text accessibilityRole="header" style={s.caption}>Хранится о вас</Text><View style={s.panel}>{rows.map(([label, value]) => <View key={label} style={s.row}><Text style={s.rowCaption}>{label}</Text><Text selectable style={s.body}>{value}</Text></View>)}</View></View>}
    {!record.submitted && !!(record.profile.first_name || record.profile.last_name || record.profile.telegram) && <View style={s.draft}><Text style={s.caption}>Черновик на телефоне</Text><Text style={s.body}>{record.profile.first_name} {record.profile.last_name}</Text></View>}
    {!!(error || requestError) && <Text accessibilityRole="alert" style={s.body}>{error || requestError}</Text>}
    {!pending && !active && button(status === 'rejected' ? 'Подать новую заявку' : closed ? 'Запросить доступ' : isPending ? 'Открыть заявку' : 'Запросить доступ', onRequest, !isPending)}
    {proofs && !pending && button(isPending ? 'Отозвать заявку и удалить данные' : 'Удалить мои данные…', onDelete)}
    {proofs === false && <Text style={s.caption}>Если ключи этого телефона утрачены, для удаления серверных данных напишите на dev@mypraxis.ai. Принадлежность записи проверит оператор.</Text>}
    <Text style={s.caption}>Мои занятия, напоминания и закладки хранятся только на телефоне и сохраняются при удалении данных доступа.</Text>
    <Pressable accessibilityRole="button" onPress={onPrivacy} style={s.policy}><Text style={s.link}>Политика приватности</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({
  page: { gap: 16 }, title: { fontSize: 26, lineHeight: 31, fontWeight: '700', color: C.text }, body: { fontSize: 16, lineHeight: 24, color: C.text },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.sageSoft, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 14, lineHeight: 21, color: '#645C50' }, rowCaption: { fontSize: 13, lineHeight: 19, color: '#645C50' },
  panel: { borderRadius: 20, overflow: 'hidden', backgroundColor: C.neutral100 }, row: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  draft: { padding: 16, borderRadius: 20, gap: 8, backgroundColor: C.neutral100 }, notice: { padding: 16, borderRadius: 18, gap: 8, backgroundColor: C.accentSoft },
  button: { minHeight: 52, borderRadius: 999, padding: 15, justifyContent: 'center', backgroundColor: C.neutral100, borderWidth: 1.5, borderColor: C.neutral300 }, primary: { backgroundColor: '#B2622D', borderColor: '#B2622D' },
  link: { color: C.accentDark, fontSize: 16, fontWeight: '600', textAlign: 'center' }, policy: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
});
