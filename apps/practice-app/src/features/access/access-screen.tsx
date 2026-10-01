import { AccessError, invitationErrors } from './access-errors';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import RequestScreen from './request-screen';
import { loadAccessRequest, newAccessRequest, useAccessRequest } from './request-client';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Organic as C } from '../prototype/theme';
import { logoutAccess, redeemInvitation, restoreAccess, useAccess } from './session';
import { invitationCredential } from './invitation-code';
import { clearInvitation } from './invitation-link';

export function AccessGate({ onOpen }: { onOpen: (invitation?: boolean) => void }) {
  const status = useAccess();
  const { record } = useAccessRequest();
  useEffect(() => { void loadAccessRequest(); }, []);
  const checking = status === 'loading', offline = status === 'offline';
  const pending = ['pending', 'approved'].includes(record.status), rejected = record.status === 'rejected';
  const closed = ['revoked', 'signed_out'].includes(record.status);
  const title = checking ? 'Проверяем доступ…' : offline ? 'Не удалось проверить доступ' : pending ? 'Заявка на рассмотрении' : rejected ? 'Заявка отклонена' : closed ? 'Доступ на этом телефоне закрыт' : 'Вики — для участников с доступом';
  return <ScrollView contentContainerStyle={s.page}>
    <Text accessibilityRole="header" style={s.title}>Вики</Text>
    <View style={s.panel}>
      <View style={s.gateHeading}><View style={s.gateIcon}>{checking ? <ActivityIndicator color={C.accentDark} /> : <SymbolView name={{ ios: 'lock', android: 'lock_outline', web: 'lock_outline' }} size={20} tintColor={C.sageDark} />}</View><Text style={[s.heading, { flex: 1 }]}>{title}</Text></View>
      <Text style={s.caption}>{offline ? 'Вход на этом телефоне сохранён. Проверьте интернет и повторите попытку.' : pending ? 'Доступ откроется этому телефону после одобрения организатором.' : rejected ? 'Если это ошибка, напишите организатору или подайте новую заявку.' : closed ? 'Можно подать новую заявку организатору.' : 'Отправьте заявку — организатор откроет доступ этому телефону.'}</Text>
      {!checking && <Pressable accessibilityRole="button" onPress={offline ? () => void restoreAccess() : closed ? () => void newAccessRequest().then(() => onOpen()) : () => onOpen()} style={s.button}><Text style={s.label}>{offline ? 'Проверить снова' : pending ? 'Статус заявки' : closed ? 'Подать заявку' : rejected ? 'Подробнее' : 'Запросить доступ'}</Text></Pressable>}
      {!checking && !offline && !pending && !rejected && !closed && <Pressable accessibilityRole="button" onPress={() => onOpen(true)} style={s.secondary}><Text style={s.link}>У меня есть приглашение</Text></Pressable>}
    </View>
  </ScrollView>;
}

type Props = { invitation?: string; onDone?: () => void; onCancel?: () => void; returnLabel?: string; embedded?: boolean; compact?: boolean; initialManual?: boolean; onBackAction?: (action?: () => void) => void };
export default function AccessScreen(props: Props) {
  const status = useAccess();
  const [requestFlow, setRequestFlow] = useState(!props.invitation && status !== 'active' && status !== 'offline');
  // Latch this screen into the request flow on logout; keep its success state after approval.
  if (status === 'locked' && !props.invitation && !requestFlow) setRequestFlow(true);
  const [manual, setManual] = useState(Boolean(props.initialManual));
  const { initialManual, onCancel } = props;
  const registerBack = props.onBackAction;
  useEffect(() => { registerBack?.(manual ? initialManual ? onCancel : () => setManual(false) : undefined); return () => registerBack?.(); }, [manual, registerBack, initialManual, onCancel]);
  useEffect(() => {
    if (!manual) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (initialManual) onCancel?.(); else setManual(false); return true; });
    return () => listener.remove();
  }, [manual, initialManual, onCancel]);
  if (!requestFlow || props.invitation) return <InvitationScreen {...props} />;
  const content = manual ? <>{!registerBack && <Pressable accessibilityRole="button" onPress={() => props.initialManual ? props.onCancel?.() : setManual(false)} style={s.secondary}><Text style={s.link}>‹ Заявка на доступ</Text></Pressable>}<InvitationScreen {...props} embedded compact /></>
    : <RequestScreen onInvitation={() => setManual(true)} onDone={props.onDone} onBack={props.onCancel} returnLabel={props.returnLabel ?? 'Открыть вики'} />;
  return props.embedded ? content : <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
    {props.onCancel && !manual && <Pressable accessibilityRole="button" onPress={props.onCancel} style={s.secondary}><Text style={s.link}>‹ Назад</Text></Pressable>}{content}
  </ScrollView></KeyboardAvoidingView>;
}
function InvitationScreen({ invitation, onDone, returnLabel = 'Открыть вики', onCancel, embedded = false, compact = false }: Props) {
  const status = useAccess();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [success, setSuccess] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { if (e instanceof AccessError) setRejection(e.code); else setError(e instanceof Error ? e.message : 'Не удалось проверить доступ.'); }
    finally { setBusy(false); }
  }
  async function enter() {
    const credential = invitationCredential(invitation ?? input);
    if (!credential) { setError('Проверьте код из приглашения: 12 букв и цифр. Можно также вставить ссылку целиком.'); return; }
    await act(async () => { await redeemInvitation(credential); setInput(''); setSuccess(true); });
  }
  function done() { setSuccess(false); clearInvitation(); onDone?.(); }
  function returnAfterRejection() { setRejection(null); clearInvitation(); (onCancel ?? onDone)?.(); }
  const activate = <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void enter()} style={[s.button, busy && s.disabled]}>
    <Text style={s.label}>{busy ? 'Проверяем…' : invitation ? 'Получить доступ' : 'Активировать'}</Text></Pressable>;
  const content = <View style={embedded ? s.embedded : s.page}>
    <Text accessibilityRole="header" style={[s.title, compact && { fontSize: 26 }]}>{invitation ? 'Ваше приглашение' : 'Доступ по приглашению'}</Text>
    {!compact && <View style={s.status}><Text style={s.heading}>{status === 'active' ? 'Доступ открыт' : status === 'offline' ? 'Вход сохранён' : 'Доступа пока нет'}</Text>
      <Text style={s.body}>{status === 'active' ? 'Вход сохранён на этом телефоне — пароль не нужен. Открыты материалы вики и подключение к онлайн-занятиям.' : status === 'offline' ? 'Не удалось проверить доступ. Проверьте интернет и повторите попытку.' : 'Расписание, выбор занятий и напоминания работают и без него. Материалы вики и подключение к онлайн-занятиям закрыты.'}</Text></View>}
    {status !== 'active' && <>
      {!invitation && !compact && <><Text style={s.eyebrow}>КАК ПОЛУЧИТЬ ДОСТУП</Text><View style={s.panel}>
        <Text style={s.body}>1. Попросите в школе персональное приглашение — тем же способом, каким вы обычно связываетесь со школой.</Text>
        <Text style={s.body}>2. Откройте ссылку на этом телефоне. Если приложения ещё нет, сначала установите его, затем нажмите ссылку ещё раз.</Text>
        <Text style={s.body}>3. Нажмите «Получить доступ» — или введите код ниже. Пароль и регистрация не нужны.</Text>
      </View></>}
      {!compact && <View style={s.destination}><Text style={s.body}>После активации: {returnLabel.toLocaleLowerCase('ru')}.</Text></View>}
      {compact && <Text style={s.body}>Вставьте ссылку или код из персонального приглашения.</Text>}
      {!invitation && <View style={s.field}>{!compact && <Text style={s.eyebrow}>КОД ИЗ ПРИГЛАШЕНИЯ</Text>}
        <View style={compact ? s.compactCode : s.codeRow}><TextInput accessibilityLabel="Код приглашения или ссылка" placeholder="XXXX-XXXX-XXXX" placeholderTextColor="#82796A" value={input}
          onChangeText={value => { setInput(value); setError(''); }} editable={!busy} autoCapitalize="characters" autoCorrect={false} spellCheck={false} autoComplete="off"
          maxLength={512} returnKeyType="go" onSubmitEditing={() => void enter()} style={[s.input, !compact && s.codeInput]} />{activate}</View></View>}
      {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
      {invitation && activate}
      <Text style={s.caption}>{compact ? 'Нет приглашения — вернитесь и подайте заявку.' : 'Код — запасной путь, если ссылка не открыла приложение. Он одноразовый и действует 7 дней.'}</Text>
      {status === 'offline' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(restoreAccess)} style={s.secondary}><Text style={s.link}>Проверить снова</Text></Pressable>}
    </>}
    {status === 'active' && <>
      {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
      {invitation && <Pressable accessibilityRole="button" onPress={done} style={s.button}><Text style={s.label}>{returnLabel}</Text></Pressable>}
      <Text style={s.caption}>После выхода или на другом телефоне можно подать новую заявку на доступ.</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(logoutAccess)} style={s.secondary}><Text style={s.link}>{busy ? 'Выходим…' : 'Выйти на этом телефоне'}</Text></Pressable>
    </>}
    {!compact && <Text style={s.caption}>Вход, закладки и выбор хранятся только на этом телефоне и пока не переносятся на другие устройства.</Text>}
    {invitation && onDone && <Pressable accessibilityRole="button" onPress={onCancel ?? onDone} style={s.secondary}><Text style={s.link}>Вернуться в приложение</Text></Pressable>}
    <Modal visible={success || !!rejection} animationType="fade" onRequestClose={() => rejection ? setRejection(null) : done()}>
      <SafeAreaProvider><SafeAreaView style={s.success}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => rejection ? setRejection(null) : done()} style={s.close}><SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={C.text} /></Pressable>
        <View style={s.successBody}><SymbolView name={{ ios: rejection ? 'exclamationmark.circle' : 'checkmark.circle.fill', android: rejection ? 'error_outline' : 'check_circle', web: rejection ? 'error_outline' : 'check_circle' }} size={42} tintColor={C.sageDark} />
          <Text accessibilityRole="header" style={s.title}>{rejection ? invitationErrors[rejection].title : 'Доступ открыт'}</Text>
          <Text style={s.body}>{rejection ? invitationErrors[rejection].message : 'На этом телефоне теперь доступны материалы вики и подключение к онлайн-занятиям. Вход сохранён — вводить ничего не нужно.'}</Text>
          <Text style={s.caption}>{rejection ? 'Общее расписание доступно и без приглашения.' : 'Закладки и выбор хранятся на этом телефоне и пока не переносятся на другие устройства.'}</Text>
        </View><Pressable accessibilityRole="button" onPress={() => rejection ? returnAfterRejection() : done()} style={s.button}><Text style={s.label}>{rejection ? 'Вернуться в приложение' : returnLabel}</Text></Pressable>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
  return embedded ? content : <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>{content}</ScrollView></KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  gateHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, gateIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.sageMuted, alignItems: 'center', justifyContent: 'center' }, compactCode: { gap: 16 }, flex: { flex: 1 }, scroll: { flexGrow: 1 }, page: { padding: 16, gap: 14 }, embedded: { gap: 14 }, intro: { gap: 4 }, codeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, codeInput: { flexGrow: 1, flexBasis: 175 },
  title: { fontSize: 28, fontWeight: '700', color: C.text }, heading: { fontSize: 17, fontWeight: '600', color: C.text }, body: { fontSize: 16, lineHeight: 22, color: C.text },
  caption: { fontSize: 14, lineHeight: 21, color: '#706B62' }, eyebrow: { fontSize: 13, fontWeight: '600', color: '#706B62' }, field: { gap: 10 },
  panel: { backgroundColor: C.neutral100, borderRadius: 22, padding: 16, gap: 12 }, status: { backgroundColor: '#EEE9DD', borderRadius: 20, padding: 18, gap: 8 }, destination: { backgroundColor: '#E2EDCF', padding: 14, borderRadius: 16 },
  input: { minHeight: 52, borderWidth: 1, borderColor: C.divider, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: C.text, backgroundColor: C.neutral100 },
  button: { minHeight: 52, padding: 15, borderRadius: 99, backgroundColor: '#AD602D', justifyContent: 'center' }, disabled: { opacity: 0.65 },
  label: { fontSize: 16, fontWeight: '600', color: C.white, textAlign: 'center' }, outline: { borderWidth: 1, borderColor: C.divider, borderRadius: 99, padding: 14, alignSelf: 'flex-start' },
  secondary: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 16, color: C.accentDark }, success: { flex: 1, backgroundColor: C.background, padding: 20 }, successBody: { flex: 1, justifyContent: 'center', gap: 18 }, close: { alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
